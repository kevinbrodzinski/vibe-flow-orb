import React, { useState, useEffect, useId, useMemo, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Bell, AtSign, Eye, Save, Loader2 } from 'lucide-react';
import type { FloqDetails } from '@/hooks/useFloqDetails';
import { useFloqSettings, type FloqSettings } from '@/hooks/useFloqSettings';
import { FloqSettingsSkeleton } from './FloqSettingsSkeleton';
import { WELCOME_MESSAGE_TEMPLATES } from '@/constants/welcomeMessageTemplates';
import { useIsMobile } from '@/hooks/use-mobile';

interface FloqSettingsPanelProps {
  floqDetails: FloqDetails;
}

export const FloqSettingsPanel: React.FC<FloqSettingsPanelProps> = ({ floqDetails }) => {
  const { settings: loadedSettings, isLoading, saveSettings, saving } = useFloqSettings(floqDetails.id);
  const [localSettings, setLocalSettings] = useState<FloqSettings | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [templateId, setTemplateId] = useState<string>('');
  const [showTemplatePulse, setShowTemplatePulse] = useState(false);
  const uid = useId(); // For unique IDs
  const isMobile = useIsMobile();

  // Always sync local settings when loaded settings change
  useEffect(() => {
    setLocalSettings(loadedSettings ?? null);
    // Reset hasChanges when query data changes and there are no local changes
    if (!hasChanges) {
      setHasChanges(false);
    }
  }, [loadedSettings]);

  // Reset local settings when navigating away without changes
  useEffect(() => {
    if (!hasChanges && loadedSettings) {
      setLocalSettings(loadedSettings);
    }
  }, [hasChanges, loadedSettings]);

  const currentSettings = localSettings;

  // Check for changes including pinned_note
  const hasSettingsChanges = useMemo(() => {
    if (!loadedSettings || !localSettings) return false;
    
    return (
      localSettings.notifications_enabled !== loadedSettings.notifications_enabled ||
      localSettings.mention_permissions !== loadedSettings.mention_permissions ||
      localSettings.join_approval_required !== loadedSettings.join_approval_required ||
      localSettings.activity_visibility !== loadedSettings.activity_visibility ||
      localSettings.welcome_message !== loadedSettings.welcome_message ||
      localSettings.pinned_note !== loadedSettings.pinned_note
    );
  }, [loadedSettings, localSettings]);

  useEffect(() => {
    setHasChanges(hasSettingsChanges);
  }, [hasSettingsChanges]);

  const handleSettingChange = (key: keyof FloqSettings, value: any) => {
    if (!currentSettings) return;
    
    const newSettings = {
      ...currentSettings,
      [key]: value
    };
    setLocalSettings(newSettings);
  };

  const handleSave = async () => {
    if (!localSettings || !hasChanges || saving) return;
    
    // Dismiss mobile keyboard
    if (document.activeElement && 'blur' in document.activeElement) {
      (document.activeElement as HTMLElement).blur();
    }
    
    // Normalize line endings for cross-platform consistency
    const normalizedSettings = {
      ...localSettings,
      welcome_message: localSettings.welcome_message?.replace(/\r\n/g, '\n') || ''
    };
    
    try {
      await saveSettings(normalizedSettings);
      setHasChanges(false);
    } catch (error) {
      // Error handling is done in the mutation
    }
  };

  if (isLoading || !currentSettings) {
    return (
      <div className="relative min-h-[500px]">
        <FloqSettingsSkeleton />
      </div>
    );
  }

  return (
    <div className="relative min-h-[500px]">
      {/* Screen reader announcements */}
      <div aria-live="assertive" className="sr-only"></div>
      
      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
        <fieldset disabled={saving} className={`space-y-6 ${saving ? 'opacity-60 pointer-events-none' : ''}`}>
          
          {/* Welcome Message Templates */}
          <Card className="p-4">
            <div className="space-y-4">
              <h4 className="font-medium">Quick Templates</h4>
              <Select value={templateId} onValueChange={(value) => {
                if (!value) return; // Guard against undefined/null values
                setTemplateId(value);
                const template = WELCOME_MESSAGE_TEMPLATES.find(t => t.id === value);
                if (template) {
                  handleSettingChange('welcome_message', template.content);
                  // Visual feedback that template was applied
                  setShowTemplatePulse(true);
                  setTimeout(() => setShowTemplatePulse(false), 400);
                }
              }}>
                <SelectTrigger className={isMobile ? "w-full h-12" : "w-full"}>
                  <SelectValue placeholder="Choose a welcome message template..." />
                </SelectTrigger>
                <SelectContent>
                  {WELCOME_MESSAGE_TEMPLATES.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

        <Card className="p-4">
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Notifications
          </h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor={`${uid}-notifications-switch`}>
                  <span id={`${uid}-notifications-label`}>Group Notifications</span>
                </Label>
                <p className="text-sm text-muted-foreground">
                  Send notifications for new messages and activities
                </p>
              </div>
              <Switch
                id={`${uid}-notifications-switch`}
                aria-labelledby={`${uid}-notifications-label`}
                checked={currentSettings.notifications_enabled}
                onCheckedChange={(checked) => handleSettingChange('notifications_enabled', checked)}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <AtSign className="w-4 h-4" />
            Mentions & Permissions
          </h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label id={`${uid}-mention-label`}>Who can @mention everyone</Label>
                <p className="text-sm text-muted-foreground">
                  Control who can send @all mentions to the group
                </p>
              </div>
              <Select 
                value={currentSettings.mention_permissions} 
                onValueChange={(value: 'all' | 'co-admins' | 'host') => 
                  handleSettingChange('mention_permissions', value)
                }
              >
                <SelectTrigger className={isMobile ? "w-full h-12" : "w-32 pr-7"} aria-labelledby={`${uid}-mention-label`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Anyone</SelectItem>
                  <SelectItem value="co-admins">Co-admins+</SelectItem>
                  <SelectItem value="host">Host only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="space-y-4">
          <h4 className="font-medium flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Privacy & Visibility
          </h4>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor={`${uid}-approval-switch`}>
                  <span id={`${uid}-approval-label`}>Join Approval Required</span>
                </Label>
                <p className="text-sm text-muted-foreground">
                  Require host approval for new members
                </p>
              </div>
              <Switch
                id={`${uid}-approval-switch`}
                aria-labelledby={`${uid}-approval-label`}
                checked={currentSettings.join_approval_required}
                onCheckedChange={(checked) => handleSettingChange('join_approval_required', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label id={`${uid}-visibility-label`}>Activity Visibility</Label>
                <p className="text-sm text-muted-foreground text-balance">
                  Who can see floq activities and participant list
                </p>
              </div>
              <Select 
                value={currentSettings.activity_visibility} 
                onValueChange={(value: 'public' | 'members_only') => 
                  handleSettingChange('activity_visibility', value)
                }
              >
                <SelectTrigger className={isMobile ? "w-full h-12" : "w-36 pr-7"} aria-labelledby={`${uid}-visibility-label`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="members_only">Members only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="space-y-4">
          <h4 className="font-medium">Welcome Message</h4>
          
          <div>
            <Label htmlFor={`${uid}-welcome_message`}>
              Message for new members (optional)
            </Label>
            <Textarea
              id={`${uid}-welcome_message`}
              value={currentSettings.welcome_message || ''}
              onChange={(e) => handleSettingChange('welcome_message', e.target.value)}
              placeholder="Welcome to our floq! Here's what you need to know..."
              rows={3}
              maxLength={300}
              aria-describedby={`${uid}-welcome-help`}
              className={`mt-2 transition-all duration-400 ${isMobile ? 'text-base' : ''} ${
                showTemplatePulse ? 'ring-2 ring-primary/50 animate-pulse' : ''
              }`}
            />
            <p id={`${uid}-welcome-help`} className="text-xs text-muted-foreground mt-1">
              {(localSettings?.welcome_message?.length ?? 0)}/300 characters
            </p>
          </div>
        </div>
      </Card>

      {/* Pinned Note */}
      <Card className="p-4">
        <div className="space-y-4">
          <h4 className="font-medium">Pinned Note</h4>
          
          <div>
            <Label htmlFor={`${uid}-pinned_note`}>
              Announcement for all members
            </Label>
            <Textarea
              id={`${uid}-pinned_note`}
              value={currentSettings?.pinned_note || ''}
              onChange={(e) => handleSettingChange('pinned_note', e.target.value)}
              placeholder="Important announcement or info for your floq..."
              rows={3}
              maxLength={280}
              aria-describedby={`${uid}-pinned-help`}
              className={`mt-2 transition-all duration-400 ${isMobile ? 'text-base' : ''}`}
            />
            <p id={`${uid}-pinned-help`} className="text-xs text-muted-foreground mt-1">
              {(currentSettings?.pinned_note?.length ?? 0)}/280 characters • Visible to all members
            </p>
          </div>
        </div>
      </Card>

      {hasChanges && (
        <div className={isMobile ? "w-full" : "flex justify-end"}>
          <Button 
            onClick={handleSave} 
            disabled={saving || !hasChanges}
            variant={hasChanges ? "default" : "secondary"}
            className={`${!hasChanges ? "text-muted-foreground cursor-not-allowed" : ""} ${isMobile ? "w-full h-12" : ""}`}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Save Settings
          </Button>
        </div>
        )}
        </fieldset>
      </form>
    </div>
  );
};