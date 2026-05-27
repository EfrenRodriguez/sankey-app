/**
 * app/test-renderer/page.js
 *
 * ⚠️  TEST PAGE — not for production
 *
 * Renders the Messi diagram via the generic SankeyRenderer component.
 * Should be visually identical to /messi (which uses MessiSankey.jsx directly).
 * Both routes remain active simultaneously — this page does NOT replace /messi.
 */

import SankeyRenderer from '@/components/SankeyRenderer';
import messiData      from '@/lib/gatherers/soccer/players/messi.json';

export const metadata = {
  title: 'Test Renderer — Sankey App',
  robots: { index: false, follow: false },
};

export default function TestRendererPage() {
  return (
    <>
      {/* ── Test banner ── */}
      <div style={{
        background:    '#fff3cd',
        borderBottom:  '2px solid #ffc107',
        color:         '#856404',
        fontFamily:    "'Inter','Helvetica Neue',sans-serif",
        fontSize:       13,
        fontWeight:     700,
        letterSpacing:  0.3,
        padding:       '10px 20px',
        textAlign:     'center',
        position:      'sticky',
        top:            0,
        zIndex:         999,
      }}>
        ⚠️ TEST PAGE — not for production · SankeyRenderer generic component · compare with{' '}
        <a href="/messi" style={{ color: '#533f03', textDecoration: 'underline' }}>/messi</a>
      </div>

      {/* ── Generic renderer with Messi data ── */}
      <SankeyRenderer schema={messiData} />
    </>
  );
}
