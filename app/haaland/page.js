import SankeyRenderer from '@/components/SankeyRenderer';
import haalandData    from '@/lib/gatherers/soccer/players/haaland.json';

export default function HaalandPage() {
  return <SankeyRenderer schema={haalandData} />;
}
