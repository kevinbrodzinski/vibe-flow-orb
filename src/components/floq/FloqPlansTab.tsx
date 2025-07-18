import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Plus, MapPin, Clock, Users } from 'lucide-react';
import type { FloqDetails } from '@/hooks/useFloqDetails';

interface FloqPlansTabProps {
  floqDetails: FloqDetails;
}

export const FloqPlansTab: React.FC<FloqPlansTabProps> = ({ floqDetails }) => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Plans & Events
        </h3>
        <Button size="sm" className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Plan
        </Button>
      </div>

      {/* Plans List */}
      <div className="space-y-4">
        {/* Placeholder for now - this will be connected to actual plans data later */}
        <Card className="p-6">
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="font-medium mb-2">No plans yet</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Create the first plan for this floq to coordinate activities and meetups.
            </p>
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create First Plan
            </Button>
          </div>
        </Card>
      </div>

      {/* Quick Plan Templates */}
      <Card className="p-6">
        <h4 className="font-medium mb-4">Quick Plan Templates</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button variant="outline" className="justify-start h-auto p-4">
            <div className="text-left">
              <div className="font-medium text-sm">Coffee Meetup</div>
              <div className="text-xs text-muted-foreground">Casual coffee and chat</div>
            </div>
          </Button>
          <Button variant="outline" className="justify-start h-auto p-4">
            <div className="text-left">
              <div className="font-medium text-sm">Group Activity</div>
              <div className="text-xs text-muted-foreground">Organized group event</div>
            </div>
          </Button>
          <Button variant="outline" className="justify-start h-auto p-4">
            <div className="text-left">
              <div className="font-medium text-sm">Study Session</div>
              <div className="text-xs text-muted-foreground">Collaborative learning</div>
            </div>
          </Button>
          <Button variant="outline" className="justify-start h-auto p-4">
            <div className="text-left">
              <div className="font-medium text-sm">Custom Plan</div>
              <div className="text-xs text-muted-foreground">Create from scratch</div>
            </div>
          </Button>
        </div>
      </Card>
    </div>
  );
};