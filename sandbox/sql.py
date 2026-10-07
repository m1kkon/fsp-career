import os, subprocess, sys
pg='/usr/lib/postgresql/15/bin/'
os.makedirs('/tmp/pg',exist_ok=True)
subprocess.run([pg+'initdb','-D','/tmp/pg','-A','trust','--no-locale'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True)
subprocess.run([pg+'pg_ctl','-D','/tmp/pg','-l','/tmp/pg.log','-o',"-h '' -k /tmp",'start'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True)
# The fixture and submitted SQL execute in this disposable database only.
fixture=sys.stdin.read()
result=subprocess.run([pg+'psql','-h','/tmp','-d','postgres','-X','-q','-t','-A','-v','ON_ERROR_STOP=1'],input=fixture+'\n'+sys.argv[1],text=True)
sys.exit(result.returncode)
