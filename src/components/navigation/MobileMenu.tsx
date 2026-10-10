import { Modal } from '../shared/Modal'
import { navigation } from '../../config/navigation'
import { siteConfig } from '../../config/site'
export function MobileMenu({ onClose, onNavigate }: { onClose: () => void; onNavigate: (href: string) => void }) {
  return <Modal titleId="menu-title" className="mobile-menu" onClose={onClose}>
    <h2 id="menu-title" className="site-wordmark">{siteConfig.brandName}</h2>
    <nav aria-label="Mobile navigation">{navigation.map(link => <a key={link.href} href={link.href} onClick={e => { e.preventDefault(); onNavigate(link.href) }}>{link.label}</a>)}</nav>
    <p className="small-copy">Exceptional spaces. A considered perspective.</p>
    <p className="small-copy">Concept website</p>
  </Modal>
}
