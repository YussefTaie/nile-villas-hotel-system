import { PageContainer } from '../../shared/ui/PageContainer';
import { PageHeading } from '../../shared/ui/PageHeading';

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <PageContainer>
      <PageHeading title={title} />
      <p className="route-placeholder">Feature screen placeholder</p>
    </PageContainer>
  );
}
