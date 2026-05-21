import { PageHeader } from '@/components/owner/ui';
import { OCard } from '@/components/owner/ui';

export default function OwnerSettingsPage() {
  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Location configuration and preferences."
      />
      <div style={{ padding: '28px 32px' }}>
        <OCard>
          <p style={{ fontSize: 13, color: '#9B9590', textAlign: 'center', padding: '24px 0' }}>
            Owner settings coming soon.
          </p>
        </OCard>
      </div>
    </div>
  );
}
