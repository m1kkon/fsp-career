import type { Metadata } from 'next';
import {assetUrls} from './asset-urls';
export const metadata: Metadata = {title:'ФСП Карьера — работа в IT',description:'Подтвердите навыки, найдите команду и получайте предложения с открытой зарплатой.'};
export default function Layout({children}:{children:React.ReactNode}) { return <html lang="ru"><head><meta name="theme-color" content="#6b3ec4"/><link rel="stylesheet" href={assetUrls['core.css']}/></head><body className="product-ui">{children}</body></html>; }
