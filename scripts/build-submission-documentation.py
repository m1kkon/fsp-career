#!/usr/bin/env python3
"""Build the Russian companion PDF from checked-in Markdown sources.
Requires Python 3.10+, reportlab. No network, browser, or secrets needed.
Fonts: --font-regular/--font-bold, DejaVu Sans, Arial, or repository Liberation Serif (OFL).
"""
from pathlib import Path
import argparse
import base64
from io import BytesIO
import html
import re
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, LongTable, TableStyle, PageBreak, KeepTogether
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

ROOT = Path(__file__).resolve().parents[1]
BLUE = colors.HexColor('#4934F8')
INK = colors.HexColor('#181A21')
MUTED = colors.HexColor('#5C6475')

def font_path(explicit, bold=False):
    if explicit:
        return Path(explicit)
    choices = [Path('/usr/share/fonts/truetype/dejavu') / ('DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'),
               Path('/System/Library/Fonts/Supplemental') / ('Arial Bold.ttf' if bold else 'Arial.ttf')]
    selected = next((p for p in choices if p.exists()), None)
    if selected:
        return selected
    # Same offline OFL-licensed fonts used by the product resume generator.
    exported = 'serifBold' if bold else 'serif'
    source = (ROOT/'vendor/resume-fonts.mjs').read_text(encoding='utf-8')
    match = re.search(r'export const '+exported+r' = "([A-Za-z0-9+/=]+)"',source)
    return BytesIO(base64.b64decode(match.group(1))) if match else None

def inline(s):
    s = html.escape(s)
    s = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2" color="#4934F8">\1</a>', s)
    s = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', s)
    s = re.sub(r'`([^`]+)`', r'<font color="#4934F8">\1</font>', s)
    return s

def parse(source, styles, width):
    lines = source.read_text(encoding='utf-8').splitlines()
    flow = []
    pending_caption = None
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        if line.startswith('```'):
            i += 1
            block = []
            while i < len(lines) and not lines[i].strip().startswith('```'):
                block.append(lines[i]); i += 1
            for ln in block:
                # Commands can be copied from the Markdown source; wrap safely in PDF.
                flow.append(Paragraph(html.escape(ln).replace(' ', '&#160;'), styles['Command']))
            flow.append(Spacer(1, 8)); i += 1; continue
        if line.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].strip().startswith('|'):
                cells = [c.strip() for c in lines[i].strip().strip('|').split('|')]
                if not all(re.match(r'^:?-+:?$', c.replace(' ', '')) for c in cells):
                    rows.append(cells)
                i += 1
            n = len(rows[0])
            weights = {2:[0.27,0.73],3:[0.16,0.32,0.52],4:[0.11,0.29,0.37,0.23]}.get(n,[1/n]*n)
            if rows[0][0] == 'Метод':
                weights = [0.46] + [0.54/(n-1)]*(n-1)
            data = [[Paragraph(inline(c), styles['CellHeader'] if r == 0 else styles['Cell']) for c in row] for r,row in enumerate(rows)]
            header_row = 1 if pending_caption else 0
            if pending_caption:
                data.insert(0,[Paragraph(inline(pending_caption),styles['Section'])]+['']*(n-1))
            t = LongTable(data, colWidths=[width*w for w in weights], repeatRows=header_row+1, hAlign='LEFT', rowSplitRange=(3,len(data)) if len(data)>4 else None)
            t.setStyle(TableStyle([('BACKGROUND',(0,header_row),(-1,header_row),BLUE),('VALIGN',(0,0),(-1,-1),'TOP'),
                ('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),
                ('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),
                ('ROWBACKGROUNDS',(0,header_row+1),(-1,-1),[colors.white,colors.HexColor('#F4F5FA')]),
                ('LINEBELOW',(0,header_row),(-1,header_row),0.6,BLUE),('LINEBELOW',(0,header_row+1),(-1,-1),0.3,colors.HexColor('#DDE1EB'))]))
            if pending_caption:
                t.setStyle(TableStyle([('SPAN',(0,0),(-1,0)),('LEFTPADDING',(0,0),(-1,0),0),('TOPPADDING',(0,0),(-1,0),8),('BOTTOMPADDING',(0,0),(-1,0),10)]))
                pending_caption = None
            flow += [t, Spacer(1,12)]; continue
        if line.startswith('# '):
            flow += [Paragraph(inline(line[2:]),styles['Title']),Spacer(1,12)]
        elif line.startswith('## '):
            if i+1 < len(lines) and lines[i+1].strip().startswith('|'):
                pending_caption = line[3:]
            else:
                flow.append(Paragraph(inline(line[3:]),styles['Section']))
        elif line.startswith('### '):
            flow.append(Paragraph(inline(line[4:]),styles['Subsection']))
        elif line.startswith('- '):
            flow.append(Paragraph(inline(line[2:]),styles['Bullet'],bulletText='•'))
        else:
            para = [line]
            while i+1 < len(lines) and lines[i+1].strip() and not re.match(r'^(#|\||-|```)',lines[i+1].strip()):
                i += 1; para.append(lines[i].strip())
            flow.append(Paragraph(inline(' '.join(para)),styles['Body']))
        i += 1
    return flow

class NumberedCanvas(Canvas):
    def __init__(self,*args,**kwargs):
        super().__init__(*args,**kwargs); self.saved=[]
    def showPage(self):
        self.saved.append(dict(self.__dict__)); self._startPage()
    def save(self):
        total=len(self.saved)
        for state in self.saved:
            self.__dict__.update(state)
            self.setStrokeColor(colors.HexColor('#DDE1EB')); self.line(42,42,A4[0]-42,42)
            self.setFillColor(MUTED); self.setFont('FSP',8)
            self.drawString(42,28,'ФСП Карьера | Сопроводительная документация')
            self.drawRightString(A4[0]-42,28,f'{self._pageNumber} / {total}')
            super().showPage()
        super().save()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'docs/submission-documentation.pdf')
    parser.add_argument('--font-regular'); parser.add_argument('--font-bold')
    parser.add_argument('--include-compliance',action='store_true',help='Append the internal team compliance matrix; excluded from the jury document by default.')
    args=parser.parse_args()
    for name,path in [('FSP',font_path(args.font_regular)),('FSPBold',font_path(args.font_bold,True))]:
        if path is None or (isinstance(path,Path) and not path.exists()):
            parser.error('Install DejaVu Sans or pass --font-regular and --font-bold (Cyrillic TTF).')
        pdfmetrics.registerFont(TTFont(name,str(path) if isinstance(path,Path) else path))
    pdfmetrics.registerFontFamily('FSP',normal='FSP',bold='FSPBold',italic='FSP',boldItalic='FSPBold')
    styles={
        'Title':ParagraphStyle('Title',fontName='FSPBold',fontSize=23,leading=29,textColor=INK,spaceAfter=12),
        'Section':ParagraphStyle('Section',fontName='FSPBold',fontSize=14,leading=19,textColor=BLUE,spaceBefore=15,spaceAfter=9,keepWithNext=True),
        'Subsection':ParagraphStyle('Subsection',fontName='FSPBold',fontSize=11,leading=15,textColor=INK,spaceBefore=10,spaceAfter=6,keepWithNext=True),
        'Body':ParagraphStyle('Body',fontName='FSP',fontSize=9.2,leading=13.5,textColor=INK,spaceAfter=8),
        'Bullet':ParagraphStyle('Bullet',fontName='FSP',fontSize=9.2,leading=13.5,textColor=INK,leftIndent=12,bulletIndent=0,spaceAfter=5),
        'Command':ParagraphStyle('Command',fontName='FSP',fontSize=8,leading=12,textColor=INK,backColor=colors.HexColor('#F4F5FA'),borderPadding=5,spaceAfter=2,splitLongWords=True),
        'Cell':ParagraphStyle('Cell',fontName='FSP',fontSize=8,leading=11,textColor=INK,splitLongWords=True),
        'CellHeader':ParagraphStyle('CellHeader',fontName='FSPBold',fontSize=8,leading=11,textColor=colors.white),
    }
    doc=SimpleDocTemplate(str(args.output),pagesize=A4,rightMargin=42,leftMargin=42,topMargin=42,bottomMargin=55,
        title='ФСП Карьера - сопроводительная документация',author='Команда ФСП Карьеры',invariant=1)
    width=A4[0]-84
    story=parse(ROOT/'docs/submission-documentation.md',styles,width)
    if args.include_compliance:
        story.append(PageBreak())
        story.extend(parse(ROOT/'docs/tz-compliance.md',styles,width))
    args.output.parent.mkdir(parents=True,exist_ok=True)
    doc.build(story,canvasmaker=NumberedCanvas)
    print(args.output)
if __name__=='__main__':
    main()
