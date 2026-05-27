import SankeyRenderer from '@/components/SankeyRenderer';
import messiData      from '@/lib/gatherers/soccer/players/messi.json';

export default function MessiPage() {
  return <SankeyRenderer schema={messiData} />;
}
