import React from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { EditFloqInfoForm } from './EditFloqInfoForm';
import { MemberManagementList } from './MemberManagementList';
import { FloqSettingsPanel } from './FloqSettingsPanel';
import { FloqDangerZone } from './FloqDangerZone';
import { InvitationManagement } from './InvitationManagement';
import { MobileTabSelector } from './MobileTabSelector';
import type { FloqDetails } from '@/hooks/useFloqDetails';
import { useSearchParams } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

interface ManageFloqViewProps {
  floqDetails: FloqDetails;
  onEndFloq?: () => void;
  isEndingFloq?: boolean;
}

export const ManageFloqView: React.FC<ManageFloqViewProps> = ({
  floqDetails,
  onEndFloq,
  isEndingFloq = false
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'info';
  const isMobile = useIsMobile();

  const setActiveTab = (tab: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (tab === 'info') {
      newParams.delete('tab'); // Keep URLs clean for default tab
    } else {
      newParams.set('tab', tab);
    }
    setSearchParams(newParams);
  };

  return (
    <Card className="p-4">
      <div className="space-y-4">
        <h3 className="font-semibold text-lg">Manage Floq</h3>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {isMobile ? (
            <MobileTabSelector activeTab={activeTab} onTabChange={setActiveTab} />
          ) : (
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="info">Info</TabsTrigger>
              <TabsTrigger value="members">Members</TabsTrigger>
              <TabsTrigger value="invitations">Invitations</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
              <TabsTrigger value="danger">Danger</TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="info" className="mt-4">
            <EditFloqInfoForm floqDetails={floqDetails} />
          </TabsContent>

          <TabsContent value="members" className="mt-4">
            <MemberManagementList floqDetails={floqDetails} />
          </TabsContent>

          <TabsContent value="invitations" className="mt-4">
            <InvitationManagement floqDetails={floqDetails} />
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <FloqSettingsPanel floqDetails={floqDetails} />
          </TabsContent>

          <TabsContent value="danger" className="mt-4">
            <FloqDangerZone 
              floqDetails={floqDetails} 
              onEndFloq={onEndFloq}
              isEndingFloq={isEndingFloq}
            />
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
};