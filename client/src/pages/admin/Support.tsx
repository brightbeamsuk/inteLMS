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

interface TicketCreator {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface TicketOrganisation {
  id: string;
  name: string;
  displayName: string;
}

export function AdminSupport() {
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'active' | 'closed'>('active');
  const [responseMessage, setResponseMessage] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
  if (viewMode === 'closed') {
    queryParams.append('status', 'closed');
  } else {
    // For active view, add specific status filter if selected, otherwise exclude closed
    if (statusFilter) {
      queryParams.append('status', statusFilter);
    }
    // Note: we'll filter out closed tickets on frontend for active view
  }
  if (priorityFilter) queryParams.append('priority', priorityFilter);
  if (categoryFilter) queryParams.append('category', categoryFilter);
  if (searchQuery.trim()) queryParams.append('search', searchQuery.trim());

  // Fetch support tickets
  const { data: allTickets = [], isLoading } = useQuery<SupportTicket[]>({
    queryKey: ['/api/support/tickets', queryParams.toString()],
    queryFn: () => apiRequest('GET', `/api/support/tickets?${queryParams.toString()}`).then(res => res.json()),
  });

  // Filter tickets based on view mode
  const tickets = allTickets.filter(ticket => {
    if (viewMode === 'closed') {
      return ticket.status === 'closed';
    } else {
      // Active view: exclude closed tickets
      return ticket.status !== 'closed';
    }
  });

  // Fetch ticket details with responses
  const { data: ticketDetails } = useQuery<SupportTicket & { 
    responses: SupportTicketResponse[];
    createdByUser?: TicketCreator;
    organisation?: TicketOrganisation;
  }>({
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
      toast({ title: "Ticket created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create ticket", description: error.message, variant: "destructive" });
    },
  });

  // Update ticket mutation
  const updateTicketMutation = useMutation({
    mutationFn: (data: { ticketId: string; updates: any }) =>
      apiRequest('PUT', `/api/support/tickets/${data.ticketId}`, data.updates).then(res => res.json()),
    onSuccess: (updatedTicket) => {
      queryClient.invalidateQueries({ queryKey: ['/api/support/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/support/tickets', selectedTicket?.id] });
      // Update the selected ticket to sync the UI
      if (selectedTicket && updatedTicket) {
        setSelectedTicket(updatedTicket);
      }
      toast({ title: "Ticket updated successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to update ticket", description: error.message, variant: "destructive" });
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
      queryClient.invalidateQueries({ queryKey: ['/api/support/tickets', selectedTicket?.id] });
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

  const handleUpdateTicket = (updates: any) => {
    if (!selectedTicket) return;
    updateTicketMutation.mutate({ ticketId: selectedTicket.id, updates });
  };

  const handleAddResponse = () => {
    if (!selectedTicket || !responseMessage.trim()) return;
    addResponseMutation.mutate({
      ticketId: selectedTicket.id,
      message: responseMessage,
    });
  };

  // Silent update mutation (no toast)
  const silentUpdateMutation = useMutation({
    mutationFn: (data: { ticketId: string; updates: any }) =>
      apiRequest('PUT', `/api/support/tickets/${data.ticketId}`, data.updates).then(res => res.json()),
    onSuccess: (updatedTicket) => {
      queryClient.invalidateQueries({ queryKey: ['/api/support/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/support/tickets', selectedTicket?.id] });
      queryClient.invalidateQueries({ queryKey: ['/api/support/unread-count'] });
      // Update the selected ticket to sync the UI
      if (selectedTicket && updatedTicket) {
        setSelectedTicket(updatedTicket);
      }
      // No toast message for silent updates
    },
    onError: () => {
      // Silent error handling - no toast
    },
  });

  const handleSelectTicket = (ticket: SupportTicket) => {
    setSelectedTicket(ticket);
    // Mark ticket as read when viewed by admin (silently)
    if (!ticket.isRead) {
      silentUpdateMutation.mutate({
        ticketId: ticket.id,
        updates: { isRead: true }
      });
    }
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

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Support Center</h1>
        <div className="flex items-center gap-4">
          <div className="badge badge-info">
            {tickets.length} tickets
          </div>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateForm(true)}
            data-testid="create-ticket-btn"
          >
            Create New Ticket
          </button>
        </div>
      </div>

      {/* Create Ticket Modal */}
      {showCreateForm && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">Create New Support Ticket</h3>
            
            <div className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Title *</span>
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
                  <span className="label-text">Description *</span>
                </label>
                <textarea
                  className="textarea textarea-bordered"
                  rows={4}
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  placeholder="Detailed description of your issue or request"
                  data-testid="ticket-description-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Priority</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={newTicket.priority}
                    onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                    data-testid="ticket-priority-select"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Category</span>
                  </label>
                  <select
                    className="select select-bordered"
                    value={newTicket.category}
                    onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                    data-testid="ticket-category-select"
                  >
                    <option value="general">General</option>
                    <option value="technical">Technical</option>
                    <option value="billing">Billing</option>
                    <option value="account">Account</option>
                    <option value="training">Training</option>
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
                Create Ticket
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
              <h2 className="card-title mb-4">Your Tickets</h2>
              
              {/* View Mode Tabs */}
              <div className="tabs tabs-boxed mb-4">
                <a 
                  className={`tab ${viewMode === 'active' ? 'tab-active' : ''}`}
                  onClick={() => {
                    setViewMode('active');
                    setStatusFilter('');
                    setSelectedTicket(null);
                  }}
                  data-testid="tab-active-tickets"
                >
                  Active Tickets
                </a>
                <a 
                  className={`tab ${viewMode === 'closed' ? 'tab-active' : ''}`}
                  onClick={() => {
                    setViewMode('closed');
                    setStatusFilter('');
                    setSelectedTicket(null);
                  }}
                  data-testid="tab-closed-tickets"
                >
                  Closed Tickets
                </a>
              </div>
              
              {/* Filters */}
              <div className="space-y-2 mb-4">
                {viewMode === 'active' && (
                  <select 
                    className="select select-bordered w-full select-sm"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    data-testid="filter-status"
                  >
                    <option value="">All Active Statuses</option>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                )}
                
                <select 
                  className="select select-bordered w-full select-sm"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  data-testid="filter-priority"
                >
                  <option value="">All Priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
                
                <select 
                  className="select select-bordered w-full select-sm"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  data-testid="filter-category"
                >
                  <option value="">All Categories</option>
                  <option value="technical">Technical</option>
                  <option value="billing">Billing</option>
                  <option value="account">Account</option>
                  <option value="training">Training</option>
                  <option value="feature_request">Feature Request</option>
                  <option value="bug_report">Bug Report</option>
                  <option value="general">General</option>
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
                    onClick={() => handleSelectTicket(ticket)}
                    data-testid={`ticket-card-${ticket.id}`}
                  >
                    <div className="card-body p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-xs font-mono text-primary font-bold mb-1">{ticket.ticketNumber}</div>
                          <h3 className="card-title text-sm font-medium truncate">{ticket.title}</h3>
                        </div>
                        {ticket.assignedTo && (
                          <div className="badge badge-primary badge-xs">ASSIGNED</div>
                        )}
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        <div className={`badge badge-xs ${getStatusColor(ticket.status)}`}>
                          {ticket.status}
                        </div>
                        <div className={`badge badge-xs ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority}
                        </div>
                        <div className="badge badge-xs badge-outline">
                          {ticket.category}
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
                    <p className="text-base-content/60">No tickets found</p>
                    <button
                      className="btn btn-primary btn-sm mt-2"
                      onClick={() => setShowCreateForm(true)}
                    >
                      Create Your First Ticket
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
                      <div className="text-sm font-mono text-primary font-bold mb-2">{selectedTicket.ticketNumber}</div>
                      <h2 className="card-title text-xl" data-testid="ticket-title">{selectedTicket.title}</h2>
                      <p className="text-sm text-base-content/70">
                        Created {format(new Date(selectedTicket.createdAt), 'MMM dd, yyyy HH:mm')}
                      </p>
                      {selectedTicket.assignedTo && (
                        <div className="badge badge-success badge-sm mt-2">
                          Assigned to Support Team
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <div className={`badge ${getStatusColor(selectedTicket.status)}`}>
                        {selectedTicket.status}
                      </div>
                      <div className={`badge ${getPriorityColor(selectedTicket.priority)}`}>
                        {selectedTicket.priority}
                      </div>
                    </div>
                  </div>

                  <div className="bg-base-200 p-4 rounded-lg mb-4">
                    <p className="whitespace-pre-wrap" data-testid="ticket-description">{selectedTicket.description}</p>
                  </div>

                  {/* Limited Ticket Management for Admins */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Priority</span>
                      </label>
                      <select
                        className="select select-bordered select-sm"
                        value={selectedTicket.priority}
                        onChange={(e) => handleUpdateTicket({ priority: e.target.value })}
                        data-testid="update-priority"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Status</span>
                      </label>
                      <div className="badge badge-outline">
                        Managed by Support Team
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Responses */}
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <h3 className="card-title">Conversation</h3>
                  
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {ticketDetails?.responses?.filter(response => !response.isInternal).map((response) => {
                      // Determine if this is from support (superadmin/admin) or customer
                      const isFromSupport = response.userId !== selectedTicket?.createdBy;
                      const senderRole = isFromSupport ? 'Support Team' : 'You';
                      
                      return (
                        <div
                          key={response.id}
                          className={`chat ${isFromSupport ? 'chat-start' : 'chat-end'}`}
                          data-testid={`response-${response.id}`}
                        >
                          <div className="chat-image avatar">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                              isFromSupport ? 'bg-info text-info-content' : 'bg-primary text-primary-content'
                            }`}>
                              {isFromSupport ? '🛠️' : '👤'}
                            </div>
                          </div>
                          <div className="chat-header text-xs opacity-70">
                            <span className={`font-semibold ${
                              isFromSupport ? 'text-info' : 'text-primary'
                            }`}>
                              {senderRole}
                            </span>
                            <time className="ml-2">{format(new Date(response.createdAt), 'MMM dd, HH:mm')}</time>
                          </div>
                          <div className={`chat-bubble max-w-md ${
                            isFromSupport ? 'chat-bubble-info' : 'chat-bubble-primary'
                          }`}>
                            {response.message}
                          </div>
                        </div>
                      );
                    })}
                    
                    {(!ticketDetails?.responses || ticketDetails.responses.filter(r => !r.isInternal).length === 0) && (
                      <div className="text-center py-4">
                        <p className="text-base-content/60">No responses yet</p>
                      </div>
                    )}
                  </div>

                  {/* Add Response */}
                  <div className="mt-6 space-y-4">
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Add Response</span>
                      </label>
                      <textarea
                        className="textarea textarea-bordered"
                        rows={4}
                        value={responseMessage}
                        onChange={(e) => setResponseMessage(e.target.value)}
                        placeholder="Type your response or additional information..."
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
                        Send Response
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card bg-base-100 shadow-lg">
              <div className="card-body text-center">
                <h2 className="card-title justify-center">Select a Ticket</h2>
                <p className="text-base-content/60">Choose a ticket from the list to view details and respond</p>
                <button
                  className="btn btn-primary mt-4"
                  onClick={() => setShowCreateForm(true)}
                >
                  Create New Ticket
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}