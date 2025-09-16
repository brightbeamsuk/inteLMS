import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsGdprEnabled } from "@/hooks/useGdpr";
import { type UserRightRequest } from "@shared/schema";
import { format } from "date-fns";
import { 
  Shield, 
  FileText, 
  Edit, 
  Trash2, 
  Eye, 
  Download, 
  Lock, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Search,
  Filter,
  MoreHorizontal,
  User,
  Calendar,
  MessageSquare,
  FileDown,
  Info,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// User rights type information for admin view
const userRightsInfo = {
  access: {
    title: "Right of Access",
    icon: Eye,
    article: "Article 15",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
  },
  rectification: {
    title: "Right to Rectification", 
    icon: Edit,
    article: "Article 16",
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
  },
  erasure: {
    title: "Right to Erasure",
    icon: Trash2,
    article: "Article 17",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
  },
  restriction: {
    title: "Right to Restriction",
    icon: Lock,
    article: "Article 18",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
  },
  objection: {
    title: "Right to Object",
    icon: Shield,
    article: "Article 21",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
  },
  portability: {
    title: "Right to Data Portability",
    icon: Download,
    article: "Article 20",
    color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400"
  }
};

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  expired: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
};

const statusIcons = {
  pending: Clock,
  in_progress: AlertCircle,
  completed: CheckCircle,
  rejected: XCircle,
  expired: XCircle
};

interface ExtendedUserRightRequest extends UserRightRequest {
  user?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

export function AdminUserRights() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isGdprEnabled = useIsGdprEnabled();
  
  // Filter and pagination state
  const [typeFilter, setTypeFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(20);
  
  // Modal and selected request state
  const [selectedRequest, setSelectedRequest] = useState<ExtendedUserRightRequest | null>(null);
  const [isProcessDialogOpen, setIsProcessDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingAction, setProcessingAction] = useState<'verify' | 'complete' | 'reject' | ''>("");

  // Role-based access control
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
            <span className="text-red-800 dark:text-red-200">
              Access denied. Admin privileges required.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // GDPR feature flag check
  if (!isGdprEnabled) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <span className="text-blue-800 dark:text-blue-200">
              GDPR User Rights features are not available in this configuration.
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Fetch organisation user rights requests
  const { data: requests, isLoading, refetch } = useQuery<ExtendedUserRightRequest[]>({
    queryKey: ['/api/gdpr/user-rights/admin', {
      type: typeFilter,
      status: statusFilter,
      search: searchQuery,
      limit: pageSize,
      offset: currentPage * pageSize,
      organisationId: user.role === 'superadmin' ? user.organisationId : undefined
    }],
    enabled: !!user && (user.role === 'admin' || user.role === 'superadmin'),
  });

  // Process user rights request mutation
  const processRequestMutation = useMutation({
    mutationFn: async (data: { requestId: string; action: string; adminNotes?: string; rejectionReason?: string }) => {
      return await apiRequest(`/api/gdpr/user-rights/${data.requestId}`, 'PATCH', {
        action: data.action,
        adminNotes: data.adminNotes,
        rejectionReason: data.rejectionReason
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/user-rights/admin'] });
      setIsProcessDialogOpen(false);
      setSelectedRequest(null);
      setAdminNotes("");
      setRejectionReason("");
      setProcessingAction("");
      toast({
        title: "Request processed successfully",
        description: "The user rights request has been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to process request",
        variant: "destructive",
      });
    },
  });

  const handleProcessRequest = () => {
    if (!selectedRequest || !processingAction) return;

    if (processingAction === 'reject' && !rejectionReason.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a rejection reason.",
        variant: "destructive",
      });
      return;
    }

    processRequestMutation.mutate({
      requestId: selectedRequest.id,
      action: processingAction,
      adminNotes: adminNotes.trim() || undefined,
      rejectionReason: rejectionReason.trim() || undefined
    });
  };

  const openProcessDialog = (request: ExtendedUserRightRequest, action: 'verify' | 'complete' | 'reject') => {
    setSelectedRequest(request);
    setProcessingAction(action);
    setAdminNotes(request.adminNotes || "");
    setRejectionReason(request.rejectionReason || "");
    setIsProcessDialogOpen(true);
  };

  const openDetailDialog = (request: ExtendedUserRightRequest) => {
    setSelectedRequest(request);
    setIsDetailDialogOpen(true);
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return '-';
    return format(new Date(date), 'dd MMM yyyy, HH:mm');
  };

  const getStatusBadge = (status: string) => {
    const Icon = statusIcons[status as keyof typeof statusIcons] || Clock;
    return (
      <Badge className={statusColors[status as keyof typeof statusColors] || statusColors.pending}>
        <Icon className="h-3 w-3 mr-1" />
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getRightTypeBadge = (type: string) => {
    const rightInfo = userRightsInfo[type as keyof typeof userRightsInfo];
    if (!rightInfo) return <Badge variant="outline">{type}</Badge>;
    
    const Icon = rightInfo.icon;
    return (
      <Badge className={rightInfo.color}>
        <Icon className="h-3 w-3 mr-1" />
        {rightInfo.title}
      </Badge>
    );
  };

  const getRequestsPendingAction = () => {
    return requests?.filter(req => req.status === 'pending').length || 0;
  };

  const getOverdueRequests = () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return requests?.filter(req => 
      ['pending', 'in_progress'].includes(req.status) && 
      new Date(req.requestedAt) < thirtyDaysAgo
    ).length || 0;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading user rights requests...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              User Rights Management
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Process and manage GDPR data rights requests from your organisation's users.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => refetch()}
            disabled={isLoading}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                <div>
                  <p className="text-2xl font-bold" data-testid="text-pending-count">
                    {getRequestsPendingAction()}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Pending Action</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                <div>
                  <p className="text-2xl font-bold" data-testid="text-overdue-count">
                    {getOverdueRequests()}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Overdue (30+ days)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <p className="text-2xl font-bold" data-testid="text-total-count">
                    {requests?.length || 0}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Requests</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                <div>
                  <p className="text-2xl font-bold" data-testid="text-completed-count">
                    {requests?.filter(req => req.status === 'completed').length || 0}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>Filters</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Request Type</label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger data-testid="select-type-filter">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {Object.entries(userRightsInfo).map(([key, info]) => (
                      <SelectItem key={key} value={key} data-testid={`option-type-${key}`}>
                        {info.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger data-testid="select-status-filter">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending" data-testid="option-status-pending">Pending</SelectItem>
                    <SelectItem value="in_progress" data-testid="option-status-in_progress">In Progress</SelectItem>
                    <SelectItem value="completed" data-testid="option-status-completed">Completed</SelectItem>
                    <SelectItem value="rejected" data-testid="option-status-rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                    data-testid="input-search"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Requests Table */}
        <Card>
          <CardHeader>
            <CardTitle>Rights Requests</CardTitle>
            <CardDescription>
              {requests?.length || 0} total requests found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!requests || requests.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No user rights requests found.</p>
                <p className="text-sm mt-1">Requests will appear here when users submit them.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Request Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => {
                      const isOverdue = (() => {
                        const thirtyDaysAgo = new Date();
                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                        return ['pending', 'in_progress'].includes(request.status) && 
                               new Date(request.requestedAt) < thirtyDaysAgo;
                      })();

                      return (
                        <TableRow 
                          key={request.id} 
                          className={`${isOverdue ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                          data-testid={`row-request-${request.id}`}
                        >
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <User className="h-4 w-4 text-gray-400" />
                              <div>
                                <p className="font-medium" data-testid={`text-user-${request.id}`}>
                                  {request.user?.firstName && request.user?.lastName 
                                    ? `${request.user.firstName} ${request.user.lastName}`
                                    : request.user?.email || 'Unknown User'
                                  }
                                </p>
                                {request.user?.email && (
                                  <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {request.user.email}
                                  </p>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`cell-type-${request.id}`}>
                            {getRightTypeBadge(request.type)}
                          </TableCell>
                          <TableCell data-testid={`cell-status-${request.id}`}>
                            <div className="flex items-center space-x-2">
                              {getStatusBadge(request.status)}
                              {isOverdue && (
                                <Badge variant="destructive" className="text-xs">
                                  OVERDUE
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell data-testid={`cell-submitted-${request.id}`}>
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-3 w-3 text-gray-400" />
                              <span className="text-sm">{formatDate(request.requestedAt)}</span>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`cell-updated-${request.id}`}>
                            <div className="flex items-center space-x-1">
                              <Clock className="h-3 w-3 text-gray-400" />
                              <span className="text-sm">{formatDate(request.updatedAt)}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  data-testid={`button-actions-${request.id}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem 
                                  onClick={() => openDetailDialog(request)}
                                  data-testid={`action-view-${request.id}`}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                
                                {request.status === 'pending' && (
                                  <DropdownMenuItem 
                                    onClick={() => openProcessDialog(request, 'verify')}
                                    data-testid={`action-verify-${request.id}`}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Verify & Start
                                  </DropdownMenuItem>
                                )}
                                
                                {['pending', 'in_progress'].includes(request.status) && (
                                  <>
                                    <DropdownMenuItem 
                                      onClick={() => openProcessDialog(request, 'complete')}
                                      data-testid={`action-complete-${request.id}`}
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Mark Complete
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => openProcessDialog(request, 'reject')}
                                      data-testid={`action-reject-${request.id}`}
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Reject Request
                                    </DropdownMenuItem>
                                  </>
                                )}
                                
                                {request.status === 'completed' && ['access', 'portability'].includes(request.type) && (
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      window.open(`/api/gdpr/user-rights/${request.id}/export?format=json`, '_blank');
                                    }}
                                    data-testid={`action-export-${request.id}`}
                                  >
                                    <FileDown className="h-4 w-4 mr-2" />
                                    Export Data
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Process Request Dialog */}
        <Dialog open={isProcessDialogOpen} onOpenChange={setIsProcessDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {processingAction === 'verify' && 'Verify & Start Processing'}
                {processingAction === 'complete' && 'Complete Request'}
                {processingAction === 'reject' && 'Reject Request'}
              </DialogTitle>
              <DialogDescription>
                {selectedRequest && (
                  <span>
                    Processing {userRightsInfo[selectedRequest.type as keyof typeof userRightsInfo]?.title || selectedRequest.type} request 
                    from {selectedRequest.user?.firstName && selectedRequest.user?.lastName 
                      ? `${selectedRequest.user.firstName} ${selectedRequest.user.lastName}`
                      : selectedRequest.user?.email || 'Unknown User'
                    }
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {selectedRequest && (
                <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg">
                  <p className="text-sm font-medium mb-1">Original Request:</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {selectedRequest.description}
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-2 block">Admin Notes</label>
                <Textarea
                  placeholder="Add notes about this request processing..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="min-h-[80px]"
                  data-testid="textarea-admin-notes"
                />
              </div>

              {processingAction === 'reject' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Rejection Reason *</label>
                  <Textarea
                    placeholder="Please provide a clear reason for rejecting this request..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="min-h-[80px]"
                    data-testid="textarea-rejection-reason"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This will be visible to the user and must comply with UK GDPR requirements.
                  </p>
                </div>
              )}
            </div>

            <DialogFooter className="space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setIsProcessDialogOpen(false)}
                data-testid="button-cancel-process"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleProcessRequest}
                disabled={processRequestMutation.isPending || (processingAction === 'reject' && !rejectionReason.trim())}
                data-testid="button-confirm-process"
              >
                {processRequestMutation.isPending ? 'Processing...' : 
                  processingAction === 'verify' ? 'Verify & Start' :
                  processingAction === 'complete' ? 'Mark Complete' :
                  'Reject Request'
                }
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Request Detail Dialog */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Request Details</span>
              </DialogTitle>
            </DialogHeader>

            {selectedRequest && (
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Request Type</label>
                    <div className="mt-1">{getRightTypeBadge(selectedRequest.type)}</div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                    <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">User Information</label>
                  <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <p className="font-medium">
                      {selectedRequest.user?.firstName && selectedRequest.user?.lastName 
                        ? `${selectedRequest.user.firstName} ${selectedRequest.user.lastName}`
                        : 'Unknown User'
                      }
                    </p>
                    {selectedRequest.user?.email && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedRequest.user.email}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Request Description</label>
                  <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                    <p className="text-sm">{selectedRequest.description}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Submitted</label>
                    <p className="text-sm mt-1">{formatDate(selectedRequest.requestedAt)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</label>
                    <p className="text-sm mt-1">{formatDate(selectedRequest.updatedAt)}</p>
                  </div>
                </div>

                {selectedRequest.verifiedAt && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Verified</label>
                    <p className="text-sm mt-1">{formatDate(selectedRequest.verifiedAt)}</p>
                  </div>
                )}

                {selectedRequest.completedAt && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Completed</label>
                    <p className="text-sm mt-1">{formatDate(selectedRequest.completedAt)}</p>
                  </div>
                )}

                {selectedRequest.adminNotes && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Admin Notes</label>
                    <div className="mt-1 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                      <p className="text-sm">{selectedRequest.adminNotes}</p>
                    </div>
                  </div>
                )}

                {selectedRequest.rejectionReason && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Rejection Reason</label>
                    <div className="mt-1 p-3 bg-red-50 dark:bg-red-900/30 rounded-lg">
                      <p className="text-sm">{selectedRequest.rejectionReason}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>
                Close
              </Button>
              {selectedRequest?.status === 'completed' && ['access', 'portability'].includes(selectedRequest.type) && (
                <Button
                  onClick={() => {
                    window.open(`/api/gdpr/user-rights/${selectedRequest.id}/export?format=json`, '_blank');
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Data
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Compliance Information */}
        <Card className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium">UK GDPR Compliance Reminders:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
                  <li>Respond to all requests within 30 days of receipt (extendable by 2 months in complex cases)</li>
                  <li>Verify the identity of the data subject before processing requests</li>
                  <li>Provide clear reasons for any rejections, referencing specific legal grounds</li>
                  <li>Keep detailed records of all processing activities for audit purposes</li>
                  <li>For access requests, provide data in a commonly used electronic format</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}