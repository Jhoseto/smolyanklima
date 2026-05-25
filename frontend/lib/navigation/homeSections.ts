export function getNavbarHeight(): number {
  return (
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--navbar-height')) || 72
  );
}

export function scrollToHomeSection(sectionId: string, behavior: ScrollBehavior = 'auto'): boolean {
  const el = document.getElementById(sectionId);
  if (!el) return false;
  const y = el.getBoundingClientRect().top + window.scrollY - getNavbarHeight();
  window.scrollTo({ top: Math.max(0, y), left: 0, behavior });
  return true;
}

export function scrollToPageTop(behavior: ScrollBehavior = 'auto'): void {
  window.scrollTo({ top: 0, left: 0, behavior });
}
