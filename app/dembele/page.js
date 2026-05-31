import SankeyRenderer from '@/components/SankeyRenderer';
import dembeleData from '@/lib/gatherers/soccer/players/dembele.json';

export default function DembelePage() {
  return <SankeyRenderer schema={dembeleData} />;
}
