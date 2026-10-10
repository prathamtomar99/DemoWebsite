import { Menu } from 'lucide-react'
import { siteConfig } from '../../config/site'
import { useExperience } from '../shared/experience-context'
import { navigation } from '../../config/navigation'
export function SectionNavigation({ cinema = false }: { cinema?: boolean }) {
  const { showMenu } = useExperience()
  return <div className={`section-navigation ${cinema ? 'cinema-navigation' : ''}`}>
    <nav aria-label={cinema ? 'Hero navigation' : 'Main navigation'} className="desktop-navigation">
      {navigation.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}
    </nav>
    <button className="menu-toggle" type="button" onClick={event => showMenu(event.currentTarget)} aria-label="Open navigation menu" aria-haspopup="dialog"><span>Menu</span><Menu size={20} aria-hidden="true" /></button>
  </div>
}
export function SiteNavigation() {
  return <header className="content-header"><div className="content-header-inner page-container">
    <a href="#home" className="site-wordmark">{siteConfig.brandName}</a><SectionNavigation />
  </div></header>
}
