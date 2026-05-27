import SankeyRenderer from '@/components/SankeyRenderer';
import jimenezData    from '@/lib/gatherers/soccer/players/jimenez.json';

export default function JimenezPage() {
  return <SankeyRenderer schema={jimenezData} />;
}
