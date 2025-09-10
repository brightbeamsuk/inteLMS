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

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export function SuperAdminSupport() {
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'active' | 'closed'>('active');
  const [responseMessage, setResponseMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
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

  // Fetch superadmin users for assignment
  const { data: superAdmins = [] } = useQuery<User[]>({
    queryKey: ['/api/users', 'superadmin'],
    queryFn: () => apiRequest('GET', '/api/users?role=superadmin').then(res => res.json()),
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
    mutationFn: (data: { ticketId: string; message: string; isInternal: boolean }) =>
      apiRequest('POST', `/api/support/tickets/${data.ticketId}/responses`, {
        message: data.message,
        isInternal: data.isInternal,
      }).then(res => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/support/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/support/tickets', selectedTicket?.id] });
      setResponseMessage('');
      setIsInternal(false);
      toast({ title: "Response added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add response", description: error.message, variant: "destructive" });
    },
  });

  const handleUpdateTicket = (updates: any) => {
    if (!selectedTicket) return;
    
    // Show confirmation modal when closing ticket
    if (updates.status === 'closed') {
      setShowCloseModal(true);
      return;
    }
    
    updateTicketMutation.mutate({ ticketId: selectedTicket.id, updates });
  };

  const handleConfirmClose = () => {
    if (!selectedTicket) return;
    
    // Add automatic response when closing
    const autoResponseMessage = `This ticket has been marked as closed. If you need further assistance, please create a new support ticket.\n\nThank you for using our support system!`;
    
    // First add the automatic response, then update the ticket
    addResponseMutation.mutate({
      ticketId: selectedTicket.id,
      message: autoResponseMessage,
      isInternal: false
    }, {
      onSuccess: () => {
        // After response is added, update the ticket status
        updateTicketMutation.mutate({ 
          ticketId: selectedTicket.id, 
          updates: { status: 'closed' }
        });
        setShowCloseModal(false);
        // Clear selected ticket so user sees it moved to closed section
        setSelectedTicket(null);
        // Also invalidate all ticket queries to refresh the lists
        queryClient.invalidateQueries({ queryKey: ['/api/support/tickets'] });
      }
    });
  };

  const handleAddResponse = () => {
    if (!selectedTicket || !responseMessage.trim()) return;
    addResponseMutation.mutate({
      ticketId: selectedTicket.id,
      message: responseMessage,
      isInternal,
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
    // Mark ticket as read when viewed by SuperAdmin (silently)
    if (!ticket.isRead) {
      silentUpdateMutation.mutate({
        ticketId: ticket.id,
        updates: { isRead: true }
      });
    }
  };

  const handleReopenTicket = () => {
    if (!selectedTicket) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to reopen ticket #${selectedTicket.id.slice(-8)}?\n\nThis will change the status from closed to open.`
    );
    
    if (confirmed) {
      updateTicketMutation.mutate({ 
        ticketId: selectedTicket.id, 
        updates: { status: 'open' } 
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
        <div className="badge badge-info">
          {tickets.length} tickets
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ticket List */}
        <div className="lg:col-span-1">
          <div className="card bg-base-100 shadow-lg">
            <div className="card-body">
              <h2 className="card-title mb-4">Support Tickets</h2>
              
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
                    } ${!ticket.isRead ? 'bg-warning/10 border-warning' : ''}`}
                    onClick={() => handleSelectTicket(ticket)}
                    data-testid={`ticket-card-${ticket.id}`}
                  >
                    <div className="card-body p-3">
                      <div className="flex justify-between items-start">
                        <h3 className="card-title text-sm font-medium truncate">{ticket.title}</h3>
                        {!ticket.isRead && (
                          <div className="badge badge-warning badge-xs">NEW</div>
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
                        Created {format(new Date(selectedTicket.createdAt), 'MMM dd, yyyy HH:mm')}
                      </p>
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

                  {/* Ticket Information Log */}
                  {ticketDetails?.createdByUser && (
                    <div className="alert alert-info mb-4">
                      <div className="flex items-start gap-3 w-full">
                        <div className="flex-shrink-0">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm mb-2">Ticket Information</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="font-medium">Raised by:</span>
                              <div className="mt-1">
                                <div className="font-semibold">
                                  {ticketDetails.createdByUser.firstName} {ticketDetails.createdByUser.lastName}
                                </div>
                                <div className="text-xs opacity-75">
                                  {ticketDetails.createdByUser.email}
                                </div>
                                <span className={`badge badge-xs mt-1 ${
                                  ticketDetails.createdByUser.role === 'admin' ? 'badge-warning' : 'badge-info'
                                }`}>
                                  {ticketDetails.createdByUser.role}
                                </span>
                              </div>
                            </div>
                            {ticketDetails.organisation && (
                              <div>
                                <span className="font-medium">Organisation:</span>
                                <div className="mt-1">
                                  <div className="font-semibold">
                                    {ticketDetails.organisation.displayName || ticketDetails.organisation.name}
                                  </div>
                                  <div className="text-xs opacity-75">
                                    ID: {ticketDetails.organisation.id.slice(-8)}
                                  </div>
                                </div>
                              </div>
                            )}
                            {!ticketDetails.organisation && (
                              <div>
                                <span className="font-medium">Organisation:</span>
                                <div className="mt-1">
                                  <span className="badge badge-ghost badge-sm">None (SuperAdmin)</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Ticket Management */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Status</span>
                      </label>
                      <select
                        className="select select-bordered select-sm"
                        value={selectedTicket.status}
                        onChange={(e) => handleUpdateTicket({ status: e.target.value })}
                        data-testid="update-status"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                        <option value="closed">Closed</option>
                      </select>
                    </div>

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
                        <span className="label-text">Assign To</span>
                      </label>
                      <select
                        className="select select-bordered select-sm"
                        value={selectedTicket.assignedTo || ''}
                        onChange={(e) => handleUpdateTicket({ assignedTo: e.target.value || null })}
                        data-testid="assign-ticket"
                      >
                        <option value="">Unassigned</option>
                        {superAdmins.map((admin) => (
                          <option key={admin.id} value={admin.id}>
                            {admin.firstName} {admin.lastName} ({admin.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Reopen Button for Closed Tickets */}
                  {selectedTicket.status === 'closed' && (
                    <div className="mt-4">
                      <button
                        className="btn btn-outline btn-success btn-sm"
                        onClick={handleReopenTicket}
                        data-testid="reopen-ticket"
                      >
                        🔄 Reopen Ticket
                      </button>
                    </div>
                  )}

                  {!selectedTicket.isRead && (
                    <button
                      className="btn btn-outline btn-sm mt-4"
                      onClick={() => handleUpdateTicket({ isRead: true })}
                      data-testid="mark-read"
                    >
                      Mark as Read
                    </button>
                  )}
                </div>
              </div>

              {/* Responses */}
              <div className="card bg-base-100 shadow-lg">
                <div className="card-body">
                  <h3 className="card-title">Conversation</h3>
                  
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {ticketDetails?.responses?.map((response) => {
                      // Determine if this is from support (superadmin/admin) or customer
                      const isFromSupport = response.isInternal || (response.userId !== selectedTicket?.createdBy);
                      const senderRole = response.isInternal ? 'Support (Internal)' : (isFromSupport ? 'Support Team' : 'Customer');
                      
                      return (
                        <div
                          key={response.id}
                          className={`chat ${isFromSupport ? 'chat-start' : 'chat-end'}`}
                          data-testid={`response-${response.id}`}
                        >
                          <div className="chat-image avatar">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                              response.isInternal ? 'bg-warning text-warning-content' : 
                              (isFromSupport ? 'bg-info text-info-content' : 'bg-primary text-primary-content')
                            }`}>
                              {response.isInternal ? '🔒' : (isFromSupport ? '🛠️' : '👤')}
                            </div>
                          </div>
                          <div className="chat-header text-xs opacity-70">
                            <span className={`font-semibold ${
                              response.isInternal ? 'text-warning' : 
                              (isFromSupport ? 'text-info' : 'text-primary')
                            }`}>
                              {senderRole}
                            </span>
                            {response.isInternal && (
                              <span className="badge badge-warning badge-xs ml-2">Internal</span>
                            )}
                            <time className="ml-2">{format(new Date(response.createdAt), 'MMM dd, HH:mm')}</time>
                          </div>
                          <div className={`chat-bubble max-w-md ${
                            response.isInternal ? 'chat-bubble-warning' : 
                            (isFromSupport ? 'chat-bubble-info' : 'chat-bubble-primary')
                          }`}>
                            {response.message}
                          </div>
                        </div>
                      );
                    })}
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
                        placeholder="Type your response..."
                        data-testid="response-message"
                      />
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <label className="label cursor-pointer">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm"
                          checked={isInternal}
                          onChange={(e) => setIsInternal(e.target.checked)}
                          data-testid="internal-response"
                        />
                        <span className="label-text ml-2">Internal note (not visible to user)</span>
                      </label>
                      
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
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Close Ticket Confirmation Modal */}
      {showCloseModal && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">🎫 Close Support Ticket</h3>
            <div className="py-4">
              <p className="mb-4">
                Are you sure you want to close ticket{' '}
                <span className="font-mono font-semibold">
                  #{selectedTicket?.id.slice(-8)}
                </span>
                ?
              </p>
              <div className="bg-info/10 border border-info/20 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-info">ℹ️</span>
                  <span className="font-semibold text-info">What happens next:</span>
                </div>
                <ul className="text-sm space-y-1 ml-6">
                  <li>• Ticket will be marked as closed</li>
                  <li>• Automatic notification sent to the user</li>
                  <li>• Closing message added to conversation</li>
                </ul>
              </div>
            </div>
            <div className="modal-action">
              <button 
                className="btn btn-ghost" 
                onClick={() => setShowCloseModal(false)}
                data-testid="button-cancel-close"
              >
                Cancel
              </button>
              <button 
                className={`btn btn-error ${addResponseMutation.isPending ? 'loading' : ''}`}
                onClick={handleConfirmClose}
                disabled={addResponseMutation.isPending}
                data-testid="button-confirm-close"
              >
                {addResponseMutation.isPending ? 'Closing...' : 'Close Ticket'}
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setShowCloseModal(false)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}