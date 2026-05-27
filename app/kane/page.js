import SankeyRenderer from '@/components/SankeyRenderer';
import kaneData       from '@/lib/gatherers/soccer/players/kane.json';

export default function KanePage() {
  return <SankeyRenderer schema={kaneData} />;
}
