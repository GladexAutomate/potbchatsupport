import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
import EscalationTimeline from '@/components/EscalationTimeline';

const statusColors = {
  'Open': 'bg-blue-500/20 text-blue-300',
  'In Progress': 'bg-purple-500/20 text-purple-300',
  'Pending': 'bg-yellow-500/20 text-yellow-300',
  'Resolved': 'bg-green-500/20 text-green-300',
  'Closed': 'bg-gray-500/20 text-gray-300'
};

const priorityColors = {
  'Low': 'bg-blue-500/20 text-blue-300',
  'Medium': 'bg-yellow-500/20 text-yellow-300',
  'High': 'bg-orange-500/20 text-orange-300',
  'Critical': 'bg-red-500/20 text-red-300'
};

export default function InternalEscalations() {
  const [escalations, setEscalations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      // Load all escalated internal tickets
      const escalated = await base44.entities.InternalTicket.filter({ escalated: true });
      setEscalations(escalated ? escalated.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)) : []);
    } catch (err) {
      console.error('Error loading escalations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveEscalation = async (ticketId, newStatus) => {
    try {
      await base44.entities.InternalTicket.update(ticketId, {
        status: newStatus,
        escalated: false
      });
      await loadData();
    } catch (err) {
      console.error('Error updating escalation:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Internal Ticket Escalations</h1>
        <p className="text-muted-foreground text-sm">Manage escalated internal tickets from all departments</p>
      </div>

      {escalations.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <div className="text-muted-foreground space-y-2">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No Escalations</p>
              <p className="text-sm">All internal tickets are being handled properly</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {escalations.map(ticket => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="grid gap-4">
                  {/* Top Row: Ticket Info */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="font-mono text-xs text-muted-foreground">{ticket.ticket_number}</span>
                        <Badge className={statusColors[ticket.status]}>{ticket.status}</Badge>
                        <Badge className={priorityColors[ticket.priority]}>{ticket.priority}</Badge>
                        <Badge variant="destructive">Escalated</Badge>
                      </div>
                      <h3 className="font-semibold text-lg mb-2">{ticket.subject}</h3>
                      <p className="text-sm text-muted-foreground mb-3">{ticket.description}</p>
                    </div>
                  </div>

                  {/* Department Flow */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{ticket.from_department}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-medium">{ticket.to_department}</span>
                  </div>

                  {/* Escalation Timeline */}
                  <EscalationTimeline ticket={ticket} />

                  {/* Footer: Date & Actions */}
                  <div className="flex items-center justify-between pt-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(ticket.created_date).toLocaleDateString()}
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline"
                        onClick={() => handleResolveEscalation(ticket.id, 'Resolved')}>
                        Mark Resolved
                      </Button>
                      <Button size="sm" variant="outline"
                        onClick={() => handleResolveEscalation(ticket.id, 'In Progress')}>
                        In Progress
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}