import type { Metadata } from 'next';
import {assetUrls} from './asset-urls';
export const metadata: Metadata = {title:'ФСП Карьера — работа в IT',description:'Подтвердите навыки, найдите команду и получайте предложения с открытой зарплатой.'};
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="ru"><head><meta name="theme-color" content="#6b3ec4"/>{(['styles.css','enterprise.css','marketplace.css','mvp.css','resume-editor.css','product.css'] as const).map(name=><link key={name} rel="stylesheet" href={assetUrls[name]}/>)}</head><body className="product-ui">{children}</body></html>; }
