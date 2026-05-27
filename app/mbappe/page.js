import SankeyRenderer from '@/components/SankeyRenderer';
import mbappeData     from '@/lib/gatherers/soccer/players/mbappe.json';

export default function MbappePage() {
  return <SankeyRenderer schema={mbappeData} />;
}
