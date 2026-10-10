import { siteConfig } from '../../config/site'
import { navigation } from '../../config/navigation'
export function Footer() {
  return <footer className="site-footer page-container"><div className="footer-main"><div><a className="site-wordmark" href="#home">{siteConfig.brandName}</a><p>Exceptional spaces.<br />A considered perspective.</p></div><nav aria-label="Footer navigation">{navigation.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}</nav></div>
    <div className="footer-bottom"><p>Concept website · Fictional agency & illustrative residences</p><a href="#home">Back to the residence ↑</a></div>
  </footer>
}
