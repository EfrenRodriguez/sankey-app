import SankeyRenderer from '@/components/SankeyRenderer';
import ronaldoData    from '@/lib/gatherers/soccer/players/ronaldo.json';

export default function RonaldoPage() {
  return <SankeyRenderer schema={ronaldoData} />;
}
