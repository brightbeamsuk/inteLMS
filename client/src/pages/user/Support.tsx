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
  ticketNumber?: string;
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
  if (searchQuery) queryParams.append('search', searchQuery);

  // Fetch support tickets
  const { data: allTickets = [], isLoading } = useQuery<SupportTicket[]>({
    queryKey: ['/api/support/tickets', queryParams.toString()],
    queryFn: () => apiRequest('GET', `/api/support/tickets?${queryParams.toString()}`).then(res => res.json()),
  });

  // Filter tickets based on view mode and search
  const tickets = allTickets.filter(ticket => {
    // Filter by view mode
    if (viewMode === 'active' && ticket.status === 'closed') {
      return false;
    }
    if (viewMode === 'closed' && ticket.status !== 'closed') {
      return false;
    }
    
    // Filter by search query (ticket number or title)
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase();
      const matchesTicketNumber = ticket.ticketNumber?.toLowerCase().includes(searchLower);
      const matchesTitle = ticket.title.toLowerCase().includes(searchLower);
      return matchesTicketNumber || matchesTitle;
    }
    
    return true;
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
              🙋‍♂️
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Ticket List */}
        <div className="lg:col-span-1">
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body p-6">
              <div className="flex items-center gap-3 mb-6">
                <i className="fas fa-list text-xl text-accent"></i>
                <h2 className="card-title text-xl">My Support Requests</h2>
              </div>
              
              {/* View Mode Tabs */}
              <div className="tabs tabs-bordered mb-6">
                <a 
                  className={`tab tab-lg ${viewMode === 'active' ? 'tab-active' : ''}`}
                  onClick={() => {
                    setViewMode('active');
                    setStatusFilter('');
                    setSelectedTicket(null);
                  }}
                  data-testid="tab-active-tickets"
                >
                  <i className="fas fa-clock mr-2"></i>
                  Active
                </a>
                <a 
                  className={`tab tab-lg ${viewMode === 'closed' ? 'tab-active' : ''}`}
                  onClick={() => {
                    setViewMode('closed');
                    setStatusFilter('');
                    setSelectedTicket(null);
                  }}
                  data-testid="tab-closed-tickets"
                >
                  <i className="fas fa-check-circle mr-2"></i>
                  Resolved
                </a>
              </div>
              
              {/* Search Bar */}
              <div className="form-control mb-4">
                <div className="input-group">
                  <span className="bg-base-200">
                    <i className="fas fa-search text-base-content/60"></i>
                  </span>
                  <input
                    type="text"
                    className="input input-bordered flex-1"
                    placeholder="Search your tickets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="search-tickets"
                  />
                </div>
              </div>
              
              {/* Filters */}
              <div className="space-y-3 mb-6">
                {viewMode === 'active' && (
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text font-medium">
                        <i className="fas fa-filter mr-2"></i>Status Filter
                      </span>
                    </label>
                    <select 
                      className="select select-bordered w-full"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      data-testid="filter-status"
                    >
                      <option value="">All Active</option>
                      <option value="open">🔴 Open</option>
                      <option value="in_progress">🟡 Being Reviewed</option>
                      <option value="resolved">🟢 Resolved</option>
                    </select>
                  </div>
                )}
                
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">
                      <i className="fas fa-exclamation-triangle mr-2"></i>Priority Filter
                    </span>
                  </label>
                  <select 
                    className="select select-bordered w-full"
                    value={priorityFilter}
                    onChange={(e) => setPriorityFilter(e.target.value)}
                    data-testid="filter-priority"
                  >
                    <option value="">All Priorities</option>
                    <option value="urgent">🔥 Very urgent</option>
                    <option value="high">⚠️ Important</option>
                    <option value="medium">📋 Normal</option>
                    <option value="low">📝 Not urgent</option>
                  </select>
                </div>
                
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">
                      <i className="fas fa-tags mr-2"></i>Category Filter
                    </span>
                  </label>
                  <select 
                    className="select select-bordered w-full"
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    data-testid="filter-category"
                  >
                    <option value="">All Categories</option>
                    <option value="technical">🔧 Technical</option>
                    <option value="billing">💳 Billing</option>
                    <option value="account">👤 Account</option>
                    <option value="training">📚 Training</option>
                    <option value="feature_request">💡 Feature Request</option>
                    <option value="bug_report">🐛 Bug Report</option>
                    <option value="general">💬 General</option>
                  </select>
                </div>
              </div>

              {/* Ticket List */}
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {tickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    className={`card card-compact cursor-pointer transition-all duration-200 hover:shadow-md ${
                      selectedTicket?.id === ticket.id 
                        ? 'bg-accent/10 border-accent shadow-md border-2' 
                        : 'bg-base-100 border border-base-300 hover:border-accent/50'
                    }`}
                    onClick={() => setSelectedTicket(ticket)}
                    data-testid={`ticket-card-${ticket.id}`}
                  >
                    <div className="card-body p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          {ticket.ticketNumber && (
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-mono text-accent font-bold bg-accent/10 px-2 py-1 rounded">
                                {ticket.ticketNumber}
                              </span>
                              {ticket.assignedTo && (
                                <div className="badge badge-primary badge-sm gap-1">
                                  <i className="fas fa-user-check text-xs"></i>
                                  ASSIGNED
                                </div>
                              )}
                            </div>
                          )}
                          <h3 className="font-semibold text-base leading-tight">{ticket.title}</h3>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`badge ${getStatusColor(ticket.status)} badge-sm gap-1`}>
                          <i className="fas fa-circle text-xs"></i>
                          {getStatusText(ticket.status)}
                        </div>
                        <div className={`badge ${getPriorityColor(ticket.priority)} badge-sm gap-1`}>
                          <i className="fas fa-flag text-xs"></i>
                          {ticket.priority}
                        </div>
                        <div className="badge badge-outline badge-sm gap-1">
                          <i className="fas fa-tag text-xs"></i>
                          {ticket.category.replace('_', ' ')}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-base-content/60">
                        <span className="flex items-center gap-1">
                          <i className="fas fa-clock"></i>
                          {format(new Date(ticket.createdAt), 'MMM dd, yyyy HH:mm')}
                        </span>
                        {selectedTicket?.id === ticket.id && (
                          <i className="fas fa-chevron-right text-accent"></i>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                {tickets.length === 0 && (
                  <div className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 bg-base-200 rounded-full flex items-center justify-center">
                        <i className="fas fa-comments text-2xl text-base-content/40"></i>
                      </div>
                      <div className="text-center">
                        <p className="text-base-content/60 font-medium mb-1">
                          {viewMode === 'active' ? 'No active support requests' : 'No resolved tickets'}
                        </p>
                        <p className="text-sm text-base-content/40">
                          {viewMode === 'active' ? 'Need help? We\'re here for you!' : 'Previously resolved tickets will appear here'}
                        </p>
                      </div>
                      {viewMode === 'active' && (
                        <button
                          className="btn btn-primary btn-sm gap-2"
                          onClick={() => setShowCreateForm(true)}
                        >
                          <i className="fas fa-plus"></i>
                          Contact Support
                        </button>
                      )}
                    </div>
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
                        <div className="chat-image avatar">
                          <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-center overflow-hidden">
                            {/* TODO: Replace with actual profile image when user data is available */}
                            <div className="w-full h-full rounded-full bg-info text-info-content flex items-center justify-center text-xs font-bold">
                              <span className="text-[10px]">ST</span>
                            </div>
                          </div>
                        </div>
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