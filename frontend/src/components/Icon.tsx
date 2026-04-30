import type { CSSProperties, JSX } from 'react'

export type IconName =
  | 'home' | 'rules' | 'clients' | 'deploy' | 'import' | 'settings'
  | 'search' | 'plus' | 'download' | 'upload' | 'save' | 'play' | 'more'
  | 'edit' | 'trash' | 'copy' | 'check' | 'x' | 'chevR' | 'chevD' | 'filter'
  | 'sun' | 'moon' | 'sparkles' | 'folder' | 'bell' | 'alertTri' | 'branch'
  | 'clock' | 'shield' | 'history' | 'code' | 'link' | 'tag' | 'layers'
  | 'sliders' | 'eye' | 'arrowUp' | 'arrowDown' | 'logo' | 'zap'

interface IconProps {
  name: IconName
  size?: number
  className?: string
  style?: CSSProperties
}

export function Icon({ name, size = 16, className = '', style }: IconProps) {
  const svg = {
    width: size, height: size, viewBox: '0 0 24 24',
    fill: 'none', stroke: 'currentColor', strokeWidth: 1.75,
    strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
    className: `ico ${className}`.trim(),
    style,
  }
  const paths: Record<IconName, JSX.Element> = {
    home:      <><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></>,
    rules:     <><path d="M4 6h16M4 12h16M4 18h10"/></>,
    clients:   <><circle cx="9" cy="8" r="4"/><path d="M17 11a3 3 0 1 0 0-6"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><path d="M17 14c2.5 0 4 1.5 4 4"/></>,
    deploy:    <><path d="M12 3v12"/><path d="M6 9l6-6 6 6"/><path d="M4 21h16"/></>,
    import:    <><path d="M12 3v12"/><path d="M6 15l6 6 6-6"/><path d="M4 21h16"/></>,
    settings:  <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
    search:    <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
    plus:      <><path d="M12 5v14M5 12h14"/></>,
    download:  <><path d="M12 3v12"/><path d="M6 11l6 6 6-6"/><path d="M4 21h16"/></>,
    upload:    <><path d="M12 21V9"/><path d="M6 15l6-6 6 6"/><path d="M4 3h16"/></>,
    save:      <><path d="M5 3h11l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M8 3v6h8V3"/><path d="M8 21v-6h8v6"/></>,
    play:      <><polygon points="6 3 20 12 6 21 6 3"/></>,
    more:      <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    edit:      <><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></>,
    trash:     <><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></>,
    copy:      <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></>,
    check:     <><path d="M20 6 9 17l-5-5"/></>,
    x:         <><path d="M18 6 6 18M6 6l12 12"/></>,
    chevR:     <><polyline points="9 18 15 12 9 6"/></>,
    chevD:     <><polyline points="6 9 12 15 18 9"/></>,
    filter:    <><polygon points="22 3 2 3 10 12.5 10 19 14 21 14 12.5 22 3"/></>,
    sun:       <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>,
    moon:      <><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></>,
    sparkles:  <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2 2M16 16l2 2M6 18l2-2M16 8l2-2"/></>,
    folder:    <><path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></>,
    bell:      <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></>,
    alertTri:  <><path d="M12 3 2 20h20L12 3z"/><path d="M12 10v5M12 18h0"/></>,
    branch:    <><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M6 8v8"/><path d="M6 18c6 0 12-4 12-10"/></>,
    clock:     <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    shield:    <><path d="M12 2 4 6v6c0 5 4 9 8 10 4-1 8-5 8-10V6l-8-4z"/></>,
    history:   <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 8v5l3 2"/></>,
    code:      <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>,
    link:      <><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></>,
    tag:       <><path d="M20 12 12 20l-9-9V3h8l9 9z"/><path d="M7 7h.01"/></>,
    layers:    <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
    sliders:   <><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></>,
    eye:       <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
    arrowUp:   <><path d="M12 19V5M5 12l7-7 7 7"/></>,
    arrowDown: <><path d="M12 5v14M5 12l7 7 7-7"/></>,
    logo:      <><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4"/><path d="M3 17l9 4 9-4"/></>,
    zap:       <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
  }
  return <svg {...svg}>{paths[name]}</svg>
}
