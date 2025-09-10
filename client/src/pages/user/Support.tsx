import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface SupportTicket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: 'technical' | 'billing' | 'account' | 'training' | 'feature_request' | 'bug_report' | 'general';
  createdBy: string;
  assignedTo?: string;
  organisationId?: string;
  isRead: boolean;
  createdAt: string;
  updatedAt: string;
  lastResponseAt?: string;
  resolvedAt?: string;
}

interface SupportTicketResponse {
  id: string;
  ticketId: string;
  userId: string;
  message: string;
  isInternal: boolean;
  createdAt: string;
}

export function UserSupport() {
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [responseMessage, setResponseMessage] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTicket, setNewTicket] = useState({
    title: '',
    description: '',
    priority: 'medium',
    category: 'general',
  });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Build query parameters for filtering
  const queryParams = new URLSearchParams();
  if (statusFilter) queryParams.append('status', statusFilter);

  // Fetch support tickets
  const { data: tickets = [], isLoading } = useQuery<SupportTicket[]>({
    queryKey: ['/api/support/tickets', queryParams.toString()],
    queryFn: () => apiRequest('GET', `/api/support/tickets?${queryParams.toString()}`).then(res => res.json()),
  });

  // Fetch ticket details with responses
  const { data: ticketDetails } = useQuery<SupportTicket & { responses: SupportTicketResponse[] }>({
    queryKey: ['/api/support/tickets', selectedTicket?.id],
    queryFn: () => apiRequest('GET', `/api/support/tickets/${selectedTicket?.id}`).then(res => res.json()),
    enabled: !!selectedTicket,
  });

  // Create ticket mutation
  const createTicketMutation = useMutation({
    mutationFn: (data: typeof newTicket) =>
      apiRequest('POST', '/api/support/tickets', data).then(res => res.json()),
    onSuccess: (createdTicket) => {
      queryClient.invalidateQueries({ queryKey: ['/api/support/tickets'] });
      setShowCreateForm(false);
      setNewTicket({ title: '', description: '', priority: 'medium', category: 'general' });
      setSelectedTicket(createdTicket);
      toast({ title: "Ticket created successfully", description: "Our support team will respond soon." });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create ticket", description: error.message, variant: "destructive" });
    },
  });

  // Add response mutation
  const addResponseMutation = useMutation({
    mutationFn: (data: { ticketId: string; message: string }) =>
      apiRequest('POST', `/api/support/tickets/${data.ticketId}/responses`, {
        message: data.message,
        isInternal: false,
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/support/tickets'] });
      setResponseMessage('');
      toast({ title: "Response added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add response", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateTicket = () => {
    if (!newTicket.title.trim() || !newTicket.description.trim()) return;
    createTicketMutation.mutate(newTicket);
  };

  const handleAddResponse = () => {
    if (!selectedTicket || !responseMessage.trim()) return;
    addResponseMutation.mutate({
      ticketId: selectedTicket.id,
      message: responseMessage,
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'badge-error';
      case 'high': return 'badge-warning';
      case 'medium': return 'badge-info';
      case 'low': return 'badge-success';
      default: return 'badge-ghost';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'badge-error';
      case 'in_progress': return 'badge-warning';
      case 'resolved': return 'badge-success';
      case 'closed': return 'badge-ghost';
      default: return 'badge-ghost';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'open': return 'Open';
      case 'in_progress': return 'Being Reviewed';
      case 'resolved': return 'Resolved';
      case 'closed': return 'Closed';
      default: return status;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li><a data-testid="link-user">My Dashboard</a></li>
          <li className="font-semibold" data-testid="text-current-page">Support Center</li>
        </ul>
      </div>

      {/* Dashboard Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className="avatar">
            <div className="w-12 h-12 rounded bg-accent text-accent-content flex items-center justify-center">
              <i className="fas fa-question-circle text-xl"></i>
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-page-title">Support Center</h1>
            <p className="text-base-content/60" data-testid="text-page-subtitle">Get help when you need it</p>
          </div>
        </div>
        <div className="flex gap-3">
          <div className="stats shadow">
            <div className="stat">
              <div className="stat-figure">
                <i className="fas fa-envelope text-xl text-accent"></i>
              </div>
              <div className="stat-title">My Tickets</div>
              <div className="stat-value text-accent" data-testid="stat-my-tickets">{tickets.length}</div>
              <div className="stat-desc">Support requests</div>
            </div>
          </div>
          <button
            className="btn btn-primary gap-2"
            onClick={() => setShowCreateForm(true)}
            data-testid="create-ticket-btn"
          >
            <i className="fas fa-plus"></i>
            Get Help
          </button>
        </div>
      </div>

      {/* Create Ticket Modal */}
      {showCreateForm && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Contact Support</h3>
            
            <div className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">What can we help you with? *</span>
                </label>
                <input
                  type="text"
                  className="input input-bordered"
                  value={newTicket.title}
                  onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                  placeholder="Brief description of your issue"
                  data-testid="ticket-title-input"
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Please describe your issue in detail *</span>
                </label>
                <textarea
                  className="textarea textarea-bordered"
                  rows={4}
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  placeholder="Please provide as much detail as possible to help us assist you better"
                  data-testid="ticket-description-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">How urgent is this?</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={newTicket.priority}
                    onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                    data-testid="ticket-priority-select"
                  >
                    <option value="low">Not urgent</option>
                    <option value="medium">Normal</option>
                    <option value="high">Important</option>
                    <option value="urgent">Very urgent</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">What type of issue?</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={newTicket.category}
                    onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                    data-testid="ticket-category-select"
                  >
                    <option value="general">General Question</option>
                    <option value="technical">Technical Issue</option>
                    <option value="account">Account Problem</option>
                    <option value="training">Training Content</option>
                    <option value="feature_request">Feature Request</option>
                    <option value="bug_report">Bug Report</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="modal-action">
              <button
                className="btn btn-ghost"
                onClick={() => setShowCreateForm(false)}
                data-testid="cancel-create-ticket"
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateTicket}
                disabled={!newTicket.title.trim() || !newTicket.description.trim() || createTicketMutation.isPending}
                data-testid="submit-create-ticket"
              >
                {createTicketMutation.isPending && <span className="loading loading-spinner loading-sm"></span>}
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket List */}
        <div className="lg:col-span-1">
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <h2 className="card-title mb-4">Your Support Requests</h2>
              
              {/* Status Filter */}
              <div className="mb-4">
                <select 
                  className="select select-bordered w-full select-sm"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  data-testid="filter-status"
                >
                  <option value="">All Requests</option>
                  <option value="open">Open</option>
                  <option value="in_progress">Being Reviewed</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>

              {/* Ticket List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`card card-compact border cursor-pointer transition-colors hover:bg-base-200 ${
                      selectedTicket?.id === ticket.id ? 'border-primary bg-base-200' : 'border-base-300'
                    }`}
                    onClick={() => setSelectedTicket(ticket)}
                    data-testid={`ticket-card-${ticket.id}`}
                  >
                    <div className="card-body p-3">
                      <div className="flex justify-between items-start">
                        <h3 className="card-title text-sm font-medium truncate">{ticket.title}</h3>
                        {ticket.assignedTo && (
                          <div className="badge badge-primary badge-xs">ASSIGNED</div>
                        )}
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        <div className={`badge badge-xs ${getStatusColor(ticket.status)}`}>
                          {getStatusText(ticket.status)}
                        </div>
                        <div className={`badge badge-xs ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority}
                        </div>
                      </div>
                      <p className="text-xs text-base-content/70">
                        {format(new Date(ticket.createdAt), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                ))}
                
                {tickets.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-center mb-4">
                      <div className="text-4xl mb-2">💬</div>
                      <p className="text-base-content/60">No support requests yet</p>
                      <p className="text-sm text-base-content/50 mt-1">Need help? We're here for you!</p>
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => setShowCreateForm(true)}
                    >
                      Contact Support
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Ticket Details */}
        <div className="lg:col-span-2">
          {selectedTicket ? (
            <div className="space-y-6">
              {/* Ticket Header */}
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="card-title text-xl" data-testid="ticket-title">{selectedTicket.title}</h2>
                      <p className="text-sm text-base-content/70">
                        Submitted {format(new Date(selectedTicket.createdAt), 'MMM dd, yyyy HH:mm')}
                      </p>
                      {selectedTicket.assignedTo && (
                        <div className="badge badge-success badge-sm mt-2">
                          ✓ Assigned to Support Team
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-col">
                      <div className={`badge ${getStatusColor(selectedTicket.status)}`}>
                        {getStatusText(selectedTicket.status)}
                      </div>
                      <div className={`badge ${getPriorityColor(selectedTicket.priority)}`}>
                        {selectedTicket.priority} priority
                      </div>
                    </div>
                  </div>

                  <div className="bg-base-200 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">Your Message:</h4>
                    <p className="whitespace-pre-wrap" data-testid="ticket-description">{selectedTicket.description}</p>
                  </div>

                  {selectedTicket.status === 'resolved' && selectedTicket.resolvedAt && (
                    <div className="alert alert-success">
                      <div>
                        <h3 className="font-bold">Issue Resolved!</h3>
                        <div className="text-xs">
                          Resolved on {format(new Date(selectedTicket.resolvedAt), 'MMM dd, yyyy HH:mm')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Responses */}
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <h3 className="card-title">Support Team Responses</h3>
                  
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {ticketDetails?.responses?.filter(response => !response.isInternal).map((response) => (
                      <div
                        key={response.id}
                        className="chat chat-start"
                        data-testid={`response-${response.id}`}
                      >
                        <div className="chat-header">
                          Support Team • {format(new Date(response.createdAt), 'MMM dd, HH:mm')}
                        </div>
                        <div className="chat-bubble chat-bubble-primary">
                          {response.message}
                        </div>
                      </div>
                    ))}
                    
                    {(!ticketDetails?.responses || ticketDetails.responses.filter(r => !r.isInternal).length === 0) && (
                      <div className="text-center py-4">
                        <div className="text-2xl mb-2">⏳</div>
                        <p className="text-base-content/60">Waiting for support team response</p>
                        <p className="text-sm text-base-content/50 mt-1">We typically respond within 24 hours</p>
                      </div>
                    )}
                  </div>

                  {/* Add Response */}
                  {selectedTicket.status !== 'closed' && (
                    <div className="mt-6 space-y-4">
                      <div className="form-control">
                        <label className="label">
                          <span className="label-text">Add Additional Information</span>
                        </label>
                        <textarea
                          className="textarea textarea-bordered"
                          rows={3}
                          value={responseMessage}
                          onChange={(e) => setResponseMessage(e.target.value)}
                          placeholder="Provide any additional details or updates..."
                          data-testid="response-message"
                        />
                      </div>
                      
                      <div className="flex justify-end">
                        <button
                          className="btn btn-primary"
                          onClick={handleAddResponse}
                          disabled={!responseMessage.trim() || addResponseMutation.isPending}
                          data-testid="send-response"
                        >
                          {addResponseMutation.isPending && <span className="loading loading-spinner loading-sm"></span>}
                          Send Update
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body text-center">
                <div className="text-6xl mb-4">🎧</div>
                <h2 className="card-title justify-center">Need Help?</h2>
                <p className="text-base-content/60 mb-4">
                  Our support team is here to assist you with any questions or issues you may have.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowCreateForm(true)}
                >
                  Contact Support
                </button>
                
                {tickets.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-base-content/60">
                      Or select an existing ticket from the list to view details
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}