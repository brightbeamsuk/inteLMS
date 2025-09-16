import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsGdprEnabled } from "@/hooks/useGdpr";
import { type DataBreach } from "@shared/schema";
import { format, formatDistanceToNow, isAfter, isBefore } from "date-fns";
import { 
  Shield, 
  AlertTriangle, 
  FileText, 
  Edit, 
  Trash2, 
  Eye, 
  Download, 
  Clock,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  Plus,
  Users,
  Calendar,
  TrendingUp,
  BarChart3,
  AlertCircle,
  Timer,
  Bell,
  Send,
  FileDown,
  Upload,
  MoreHorizontal,
  ExternalLink,
  Zap,
  Target,
  Activity
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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Breach severity information for styling and display
const severityInfo = {
  low: {
    title: "Low Risk",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    description: "Limited impact, unlikely to result in harm"
  },
  medium: {
    title: "Medium Risk", 
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    description: "Some impact possible, ICO notification required"
  },
  high: {
    title: "High Risk",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    description: "Significant impact likely, individual notification required"
  },
  critical: {
    title: "Critical Risk",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    description: "Severe impact certain, immediate action required"
  }
};

// Breach status information
const statusInfo = {
  detected: {
    title: "Detected",
    icon: AlertTriangle,
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
  },
  assessed: {
    title: "Assessed",
    icon: Eye,
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
  },
  notified_ico: {
    title: "ICO Notified",
    icon: Send,
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
  },
  notified_subjects: {
    title: "Subjects Notified",
    icon: Bell,
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
  },
  resolved: {
    title: "Resolved",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
  }
};

// Data categories for GDPR compliance
const dataCategories = [
  "Personal identifiers",
  "Contact details", 
  "Financial information",
  "Health data",
  "Biometric data",
  "Location data",
  "Online identifiers",
  "Special category data",
  "Criminal conviction data",
  "Employment data",
  "Education data",
  "Technical data"
];

// Breach reporting form schema
const breachFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  detectedAt: z.string().optional(),
  affectedSubjects: z.coerce.number().min(0, "Must be 0 or greater"),
  dataCategories: z.array(z.string()).min(1, "At least one data category required"),
  cause: z.string().min(1, "Cause is required"),
  impact: z.string().min(1, "Impact assessment is required"),
  containmentMeasures: z.string().min(1, "Containment measures are required"),
  preventiveMeasures: z.string().min(1, "Preventive measures are required"),
  responsible: z.string().optional(),
  riskAssessment: z.object({
    likelihood: z.enum(['low', 'medium', 'high']).optional(),
    severity: z.enum(['low', 'medium', 'high']).optional(),
    riskScore: z.number().optional(),
    mitigatingFactors: z.string().optional()
  }).optional()
});

export default function BreachManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isGdprEnabled = useIsGdprEnabled();
  
  // State management
  const [selectedBreach, setSelectedBreach] = useState<DataBreach | null>(null);
  const [isNewBreachDialogOpen, setIsNewBreachDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isIcoNotifyDialogOpen, setIsIcoNotifyDialogOpen] = useState(false);
  const [isBulkNotifyDialogOpen, setIsBulkNotifyDialogOpen] = useState(false);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [recipientEmails, setRecipientEmails] = useState<string[]>(['']);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [filters, setFilters] = useState({
    search: "",
    severity: "",
    status: ""
  });

  // GDPR feature guard
  if (!isGdprEnabled) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Shield className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-600" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
            GDPR Features Disabled
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Breach management features are not available when GDPR compliance is disabled.
          </p>
        </div>
      </div>
    );
  }

  // Role-based access control
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Shield className="mx-auto h-16 w-16 text-red-400" />
          <h2 className="mt-4 text-xl font-semibold text-gray-900 dark:text-gray-100">
            Access Denied
          </h2>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Admin privileges required for breach management.
          </p>
        </div>
      </div>
    );
  }

  // Fetch breaches with filters
  const { data: breaches = [], isLoading, error } = useQuery({
    queryKey: ['/api/gdpr/breaches', filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filters.search) params.set('search', filters.search);
      if (filters.severity) params.set('severity', filters.severity);
      if (filters.status) params.set('status', filters.status);
      
      return apiRequest('GET', `/api/gdpr/breaches?${params.toString()}`).then(res => res.json());
    },
    enabled: !!user && ['admin', 'superadmin'].includes(user.role)
  });

  // Fetch breach analytics
  const { data: analytics } = useQuery({
    queryKey: ['/api/gdpr/breaches/analytics'],
    queryFn: () => apiRequest('GET', '/api/gdpr/breaches/analytics').then(res => res.json()),
    enabled: !!user && ['admin', 'superadmin'].includes(user.role)
  });

  // Create new breach mutation
  const createBreachMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/gdpr/breaches', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/breaches'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/breaches/analytics'] });
      setIsNewBreachDialogOpen(false);
      toast({
        title: "Breach Reported",
        description: "Data breach has been successfully reported and logged."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to report breach",
        variant: "destructive"
      });
    }
  });

  // Update breach mutation
  const updateBreachMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => 
      apiRequest('PUT', `/api/gdpr/breaches/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/breaches'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/breaches/analytics'] });
      setIsEditDialogOpen(false);
      setSelectedBreach(null);
      toast({
        title: "Breach Updated",
        description: "Breach record has been successfully updated."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to update breach",
        variant: "destructive"
      });
    }
  });

  // ICO notification mutation
  const icoNotifyMutation = useMutation({
    mutationFn: (breachId: string) => 
      apiRequest('PATCH', `/api/gdpr/breaches/${breachId}/ico-notify`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/breaches'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/breaches/analytics'] });
      setIsIcoNotifyDialogOpen(false);
      setSelectedBreach(null);
      toast({
        title: "ICO Notified",
        description: "ICO has been successfully notified about this data breach."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to notify ICO",
        variant: "destructive"
      });
    }
  });

  // Individual notifications mutation
  const bulkNotifyMutation = useMutation({
    mutationFn: ({ breachId, emails, message }: { breachId: string; emails: string[]; message?: string }) =>
      apiRequest('PATCH', `/api/gdpr/breaches/${breachId}/notify-subjects`, {
        recipientEmails: emails.filter(email => email.trim()),
        notificationMessage: message
      }),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/breaches'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/breaches/analytics'] });
      setIsBulkNotifyDialogOpen(false);
      setSelectedBreach(null);
      setRecipientEmails(['']);
      setNotificationMessage('');
      toast({
        title: "Individual Notifications Sent",
        description: `${data.summary?.successful || 0} of ${data.summary?.totalSent || 0} notifications sent successfully.`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send individual notifications",
        variant: "destructive"
      });
    }
  });

  // Resolve breach mutation
  const resolveMutation = useMutation({
    mutationFn: ({ breachId, data }: { breachId: string; data: any }) =>
      apiRequest(`/api/gdpr/breaches/${breachId}/resolve`, {
        method: 'PATCH',
        body: JSON.stringify(data)
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/breaches'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/breaches/analytics'] });
      setIsResolveDialogOpen(false);
      setSelectedBreach(null);
      toast({
        title: "Breach Resolved",
        description: "Data breach has been successfully resolved and closed."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to resolve breach",
        variant: "destructive"
      });
    }
  });

  // Export breach register
  const exportBreaches = async (format: 'json' | 'csv') => {
    try {
      const response = await fetch(`/api/gdpr/breaches/export?format=${format}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `breach_register_${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Export Complete",
        description: `Breach register exported as ${format.toUpperCase()}`
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export breach register",
        variant: "destructive"
      });
    }
  };

  // Form for new breach
  const form = useForm<z.infer<typeof breachFormSchema>>({
    resolver: zodResolver(breachFormSchema),
    defaultValues: {
      title: "",
      description: "",
      severity: "medium",
      affectedSubjects: 0,
      dataCategories: [],
      cause: "",
      impact: "",
      containmentMeasures: "",
      preventiveMeasures: "",
      responsible: user ? `${user.firstName} ${user.lastName}` : "",
      riskAssessment: {
        likelihood: "medium",
        severity: "medium",
        mitigatingFactors: ""
      }
    }
  });

  const onSubmit = (data: z.infer<typeof breachFormSchema>) => {
    // Calculate risk score
    const riskScore = calculateRiskScore(
      data.riskAssessment?.likelihood || 'medium',
      data.riskAssessment?.severity || 'medium'
    );
    
    createBreachMutation.mutate({
      ...data,
      riskAssessment: {
        ...data.riskAssessment,
        riskScore
      }
    });
  };

  // Risk scoring helper
  const calculateRiskScore = (likelihood: string, severity: string): number => {
    const likelihoodScore = { low: 1, medium: 2, high: 3 }[likelihood] || 2;
    const severityScore = { low: 1, medium: 2, high: 3 }[severity] || 2;
    return likelihoodScore * severityScore;
  };

  // Get urgent breaches (deadline within 24 hours)
  const urgentBreaches = breaches.filter((breach: any) => 
    breach.complianceStatus?.isUrgent || breach.complianceStatus?.isOverdue
  );

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive" data-testid="alert-error">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Breach Management</AlertTitle>
          <AlertDescription>
            Failed to load breach management interface. Please refresh the page or contact support.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" data-testid="breach-management-container">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
            Breach Management
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            GDPR Articles 33 & 34 Compliance - Data Breach Notification Management
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => exportBreaches('json')}
            data-testid="button-export-json"
          >
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
          <Button 
            variant="outline" 
            onClick={() => exportBreaches('csv')}
            data-testid="button-export-csv"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Dialog open={isNewBreachDialogOpen} onOpenChange={setIsNewBreachDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-report-breach">
                <Plus className="h-4 w-4 mr-2" />
                Report Breach
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </div>

      {/* Urgent Alerts */}
      {urgentBreaches.length > 0 && (
        <Alert variant="destructive" data-testid="alert-urgent-breaches">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Urgent Action Required</AlertTitle>
          <AlertDescription>
            {urgentBreaches.length} breach{urgentBreaches.length > 1 ? 'es' : ''} require immediate attention. 
            ICO notification deadlines are approaching or have passed.
          </AlertDescription>
        </Alert>
      )}

      {/* Analytics Dashboard */}
      {analytics && (
        <div className="grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Breaches</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-breaches">
                {analytics.totalBreaches}
              </div>
              <p className="text-xs text-muted-foreground">
                All time breach records
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Critical Breaches</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600" data-testid="text-critical-breaches">
                {analytics.criticalBreaches}
              </div>
              <p className="text-xs text-muted-foreground">
                High-impact incidents
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Notifications</CardTitle>
              <Timer className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600" data-testid="text-overdue-notifications">
                {analytics.complianceMetrics?.overdueNotifications || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Past 72-hour deadline
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-compliance-rate">
                {analytics.complianceMetrics?.complianceRate || 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                On-time notifications
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Breach Register</CardTitle>
          <CardDescription>
            View and manage data breach records with ICO compliance tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1">
              <Input
                placeholder="Search breaches..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="max-w-sm"
                data-testid="input-search-breaches"
              />
            </div>
            <Select
              value={filters.severity}
              onValueChange={(value) => setFilters(prev => ({ ...prev, severity: value }))}
            >
              <SelectTrigger className="w-48" data-testid="select-severity-filter">
                <SelectValue placeholder="Filter by severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Severities</SelectItem>
                <SelectItem value="low">Low Risk</SelectItem>
                <SelectItem value="medium">Medium Risk</SelectItem>
                <SelectItem value="high">High Risk</SelectItem>
                <SelectItem value="critical">Critical Risk</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={filters.status}
              onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            >
              <SelectTrigger className="w-48" data-testid="select-status-filter">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Statuses</SelectItem>
                <SelectItem value="detected">Detected</SelectItem>
                <SelectItem value="assessed">Assessed</SelectItem>
                <SelectItem value="notified_ico">ICO Notified</SelectItem>
                <SelectItem value="notified_subjects">Subjects Notified</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Breaches Table */}
      <Card>
        <CardContent className="p-0">
          <div className="rounded-md border" data-testid="table-breaches">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Breach Details</TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Affected Subjects</TableHead>
                  <TableHead>ICO Deadline</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2">Loading breaches...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : breaches.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <div className="text-center">
                        <Shield className="mx-auto h-12 w-12 text-gray-400" />
                        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                          No breaches found
                        </h3>
                        <p className="mt-1 text-sm text-gray-500">
                          {filters.search || filters.severity || filters.status 
                            ? "No breaches match your current filters."
                            : "No data breaches have been reported yet."
                          }
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  breaches.map((breach: any) => {
                    const severityConfig = severityInfo[breach.severity as keyof typeof severityInfo];
                    const statusConfig = statusInfo[breach.status as keyof typeof statusInfo];
                    const StatusIcon = statusConfig?.icon || AlertCircle;
                    
                    return (
                      <TableRow key={breach.id} data-testid={`row-breach-${breach.id}`}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {breach.title}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                              {breach.description}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              Detected: {format(new Date(breach.detectedAt), 'PPp')}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={severityConfig?.color} data-testid={`badge-severity-${breach.id}`}>
                            {severityConfig?.title}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <StatusIcon className="h-4 w-4" />
                            <Badge className={statusConfig?.color} data-testid={`badge-status-${breach.id}`}>
                              {statusConfig?.title}
                            </Badge>
                          </div>
                          {breach.complianceStatus?.isOverdue && (
                            <Badge variant="destructive" className="mt-1">
                              Overdue
                            </Badge>
                          )}
                          {breach.complianceStatus?.isUrgent && !breach.complianceStatus?.isOverdue && (
                            <Badge variant="destructive" className="mt-1">
                              Urgent
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell data-testid={`text-affected-subjects-${breach.id}`}>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {breach.affectedSubjects.toLocaleString()}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {breach.complianceStatus?.hoursUntilDeadline > 0 
                                ? `${breach.complianceStatus.hoursUntilDeadline}h remaining`
                                : breach.complianceStatus?.deadlinePassed
                                  ? "Deadline passed"
                                  : "No deadline"
                              }
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {format(new Date(breach.notificationDeadline), 'PPp')}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0" data-testid={`button-actions-${breach.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={() => {
                                  setSelectedBreach(breach);
                                  setIsViewDialogOpen(true);
                                }}
                                data-testid={`action-view-${breach.id}`}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => {
                                  setSelectedBreach(breach);
                                  setIsEditDialogOpen(true);
                                }}
                                data-testid={`action-edit-${breach.id}`}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Update Status
                              </DropdownMenuItem>
                              {breach.complianceStatus?.icoNotificationRequired && !breach.icoNotifiedAt && (
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedBreach(breach);
                                    setIsIcoNotifyDialogOpen(true);
                                  }}
                                  className="text-blue-600"
                                  data-testid={`action-notify-ico-${breach.id}`}
                                >
                                  <Send className="h-4 w-4 mr-2" />
                                  Send ICO Notification
                                </DropdownMenuItem>
                              )}
                              {breach.complianceStatus?.subjectNotificationRequired && !breach.subjectsNotifiedAt && (
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedBreach(breach);
                                    setIsBulkNotifyDialogOpen(true);
                                  }}
                                  className="text-purple-600"
                                  data-testid={`action-notify-subjects-${breach.id}`}
                                >
                                  <Bell className="h-4 w-4 mr-2" />
                                  Notify Affected Subjects
                                </DropdownMenuItem>
                              )}
                              {breach.status !== 'resolved' && (
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedBreach(breach);
                                    setIsResolveDialogOpen(true);
                                  }}
                                  className="text-green-600"
                                  data-testid={`action-resolve-${breach.id}`}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Resolve Breach
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* New Breach Dialog */}
      <Dialog open={isNewBreachDialogOpen} onOpenChange={setIsNewBreachDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-new-breach">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Report Data Breach
            </DialogTitle>
            <DialogDescription>
              Report a new data breach incident. All fields marked with * are required for GDPR compliance.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="basic">Basic Information</TabsTrigger>
                  <TabsTrigger value="assessment">Risk Assessment</TabsTrigger>
                  <TabsTrigger value="response">Response Measures</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Breach Title *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Brief descriptive title for the breach" 
                            {...field}
                            data-testid="input-breach-title"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Detailed description of what happened, when it was discovered, and current situation"
                            {...field}
                            rows={4}
                            data-testid="textarea-breach-description"
                          />
                        </FormControl>
                        <FormDescription>
                          Provide comprehensive details for regulatory reporting
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="severity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Risk Severity *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-breach-severity">
                                <SelectValue placeholder="Select risk level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(severityInfo).map(([value, info]) => (
                                <SelectItem key={value} value={value}>
                                  <div>
                                    <div className="font-medium">{info.title}</div>
                                    <div className="text-sm text-gray-600">{info.description}</div>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="affectedSubjects"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Affected Data Subjects *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="Number of individuals affected"
                              {...field}
                              data-testid="input-affected-subjects"
                            />
                          </FormControl>
                          <FormDescription>
                            Approximate number of individuals whose personal data was compromised
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="dataCategories"
                    render={() => (
                      <FormItem>
                        <div className="mb-4">
                          <FormLabel>Data Categories Affected *</FormLabel>
                          <FormDescription>
                            Select all types of personal data that were compromised
                          </FormDescription>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {dataCategories.map((item) => (
                            <FormField
                              key={item}
                              control={form.control}
                              name="dataCategories"
                              render={({ field }) => {
                                return (
                                  <FormItem
                                    key={item}
                                    className="flex flex-row items-start space-x-3 space-y-0"
                                  >
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(item)}
                                        onCheckedChange={(checked) => {
                                          return checked
                                            ? field.onChange([...field.value, item])
                                            : field.onChange(
                                                field.value?.filter(
                                                  (value) => value !== item
                                                )
                                              );
                                        }}
                                        data-testid={`checkbox-data-category-${item.toLowerCase().replace(/\s+/g, '-')}`}
                                      />
                                    </FormControl>
                                    <FormLabel className="text-sm font-normal">
                                      {item}
                                    </FormLabel>
                                  </FormItem>
                                );
                              }}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="assessment" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="cause"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Root Cause *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="What caused this breach? (e.g., human error, cyber attack, system failure, etc.)"
                            {...field}
                            rows={3}
                            data-testid="textarea-breach-cause"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="impact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Impact Assessment *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="What are the likely consequences for affected individuals? Consider identity theft, financial loss, reputational damage, etc."
                            {...field}
                            rows={3}
                            data-testid="textarea-breach-impact"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="riskAssessment.likelihood"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Likelihood of Harm</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-risk-likelihood">
                                <SelectValue placeholder="Select likelihood" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low - Unlikely to cause harm</SelectItem>
                              <SelectItem value="medium">Medium - May cause some harm</SelectItem>
                              <SelectItem value="high">High - Likely to cause significant harm</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="riskAssessment.severity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Severity of Harm</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-risk-severity">
                                <SelectValue placeholder="Select severity" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low - Minor inconvenience</SelectItem>
                              <SelectItem value="medium">Medium - Moderate impact</SelectItem>
                              <SelectItem value="high">High - Serious consequences</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="riskAssessment.mitigatingFactors"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mitigating Factors</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Any factors that reduce the risk (e.g., data was encrypted, limited exposure time, quick containment, etc.)"
                            {...field}
                            rows={3}
                            data-testid="textarea-mitigating-factors"
                          />
                        </FormControl>
                        <FormDescription>
                          Document any circumstances that may lessen the impact
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                <TabsContent value="response" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="containmentMeasures"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Containment Measures *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="What immediate steps were taken to contain the breach and prevent further data loss?"
                            {...field}
                            rows={3}
                            data-testid="textarea-containment-measures"
                          />
                        </FormControl>
                        <FormDescription>
                          Document all actions taken to stop the breach
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="preventiveMeasures"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preventive Measures *</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="What measures are being implemented to prevent similar breaches in the future?"
                            {...field}
                            rows={3}
                            data-testid="textarea-preventive-measures"
                          />
                        </FormControl>
                        <FormDescription>
                          Long-term improvements to prevent recurrence
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="responsible"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Responsible Person</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Person responsible for managing this breach"
                            {...field}
                            data-testid="input-responsible-person"
                          />
                        </FormControl>
                        <FormDescription>
                          Data Protection Officer or designated responsible person
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsNewBreachDialogOpen(false)}
                  data-testid="button-cancel-breach"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createBreachMutation.isPending}
                  data-testid="button-submit-breach"
                >
                  {createBreachMutation.isPending ? "Reporting..." : "Report Breach"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Breach Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-view-breach">
          {selectedBreach && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Breach Details: {selectedBreach.title}
                </DialogTitle>
                <DialogDescription>
                  Comprehensive breach record for GDPR compliance tracking
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {/* Compliance Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Compliance Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-2">
                          {(selectedBreach as any).complianceStatus?.icoNotificationRequired ? (
                            <CheckCircle className="h-6 w-6 text-green-600" />
                          ) : (
                            <XCircle className="h-6 w-6 text-gray-400" />
                          )}
                        </div>
                        <p className="text-sm font-medium">ICO Notification</p>
                        <p className="text-xs text-gray-600">
                          {(selectedBreach as any).complianceStatus?.icoNotificationRequired ? "Required" : "Not Required"}
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-2">
                          {(selectedBreach as any).complianceStatus?.subjectNotificationRequired ? (
                            <CheckCircle className="h-6 w-6 text-green-600" />
                          ) : (
                            <XCircle className="h-6 w-6 text-gray-400" />
                          )}
                        </div>
                        <p className="text-sm font-medium">Subject Notification</p>
                        <p className="text-xs text-gray-600">
                          {(selectedBreach as any).complianceStatus?.subjectNotificationRequired ? "Required" : "Not Required"}
                        </p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-2">
                          {(selectedBreach as any).complianceStatus?.isOverdue ? (
                            <AlertTriangle className="h-6 w-6 text-red-600" />
                          ) : (
                            <Clock className="h-6 w-6 text-blue-600" />
                          )}
                        </div>
                        <p className="text-sm font-medium">Timeline</p>
                        <p className="text-xs text-gray-600">
                          {(selectedBreach as any).complianceStatus?.hoursUntilDeadline > 0 
                            ? `${(selectedBreach as any).complianceStatus.hoursUntilDeadline}h remaining`
                            : (selectedBreach as any).complianceStatus?.isOverdue
                              ? "Overdue"
                              : "On Track"
                          }
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Breach Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Breach Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Title</p>
                        <p className="text-sm">{selectedBreach.title}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Description</p>
                        <p className="text-sm">{selectedBreach.description}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Severity</p>
                        <Badge className={severityInfo[selectedBreach.severity as keyof typeof severityInfo]?.color}>
                          {severityInfo[selectedBreach.severity as keyof typeof severityInfo]?.title}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Affected Subjects</p>
                        <p className="text-sm">{selectedBreach.affectedSubjects.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-600">Data Categories</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedBreach.dataCategories.map((category: string) => (
                            <Badge key={category} variant="secondary" className="text-xs">
                              {category}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Timeline</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Detected</p>
                        <p className="text-sm">{format(new Date(selectedBreach.detectedAt), 'PPp')}</p>
                      </div>
                      {selectedBreach.reportedAt && (
                        <div>
                          <p className="text-sm font-medium text-gray-600">Reported</p>
                          <p className="text-sm">{format(new Date(selectedBreach.reportedAt), 'PPp')}</p>
                        </div>
                      )}
                      {selectedBreach.icoNotifiedAt && (
                        <div>
                          <p className="text-sm font-medium text-gray-600">ICO Notified</p>
                          <p className="text-sm">{format(new Date(selectedBreach.icoNotifiedAt), 'PPp')}</p>
                        </div>
                      )}
                      {selectedBreach.subjectsNotifiedAt && (
                        <div>
                          <p className="text-sm font-medium text-gray-600">Subjects Notified</p>
                          <p className="text-sm">{format(new Date(selectedBreach.subjectsNotifiedAt), 'PPp')}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-gray-600">Notification Deadline</p>
                        <p className="text-sm">{format(new Date(selectedBreach.notificationDeadline), 'PPp')}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Response Measures */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Response Measures</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2">Root Cause</p>
                      <p className="text-sm">{selectedBreach.cause}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2">Impact Assessment</p>
                      <p className="text-sm">{selectedBreach.impact}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2">Containment Measures</p>
                      <p className="text-sm">{selectedBreach.containmentMeasures}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2">Preventive Measures</p>
                      <p className="text-sm">{selectedBreach.preventiveMeasures}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2">Responsible Person</p>
                      <p className="text-sm">{selectedBreach.responsible}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ICO Notification Dialog */}
      <Dialog open={isIcoNotifyDialogOpen} onOpenChange={setIsIcoNotifyDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-ico-notify">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-blue-600" />
              Send ICO Notification
            </DialogTitle>
            <DialogDescription>
              Article 33 GDPR - Notify the Information Commissioner's Office within 72 hours of breach detection
            </DialogDescription>
          </DialogHeader>
          
          {selectedBreach && (
            <div className="space-y-4">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Regulatory Requirement</AlertTitle>
                <AlertDescription>
                  This will send an official notification to the ICO. Ensure all breach details are accurate before proceeding.
                </AlertDescription>
              </Alert>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Breach Title:</strong>
                  <p className="text-gray-600 dark:text-gray-400">{selectedBreach.title}</p>
                </div>
                <div>
                  <strong>Severity:</strong>
                  <Badge className={severityInfo[selectedBreach.severity as keyof typeof severityInfo]?.color}>
                    {severityInfo[selectedBreach.severity as keyof typeof severityInfo]?.title}
                  </Badge>
                </div>
                <div>
                  <strong>Affected Subjects:</strong>
                  <p className="text-gray-600 dark:text-gray-400">{selectedBreach.affectedSubjects.toLocaleString()}</p>
                </div>
                <div>
                  <strong>ICO Deadline:</strong>
                  <p className="text-gray-600 dark:text-gray-400">
                    {format(new Date(selectedBreach.notificationDeadline), 'PPp')}
                  </p>
                </div>
              </div>
              
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <h4 className="font-medium mb-2">What will be sent:</h4>
                <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                  <li>• Complete breach details and impact assessment</li>
                  <li>• Data categories affected and number of subjects</li>
                  <li>• Containment and preventive measures taken</li>
                  <li>• Organisation contact information</li>
                  <li>• Compliance with Article 33 requirements</li>
                </ul>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsIcoNotifyDialogOpen(false)}
              data-testid="button-cancel-ico"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedBreach) {
                  icoNotifyMutation.mutate(selectedBreach.id);
                }
              }}
              disabled={icoNotifyMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
              data-testid="button-confirm-ico"
            >
              {icoNotifyMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Sending...
                </div>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send ICO Notification
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Individual Notification Dialog */}
      <Dialog open={isBulkNotifyDialogOpen} onOpenChange={setIsBulkNotifyDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-bulk-notify">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-purple-600" />
              Notify Affected Data Subjects
            </DialogTitle>
            <DialogDescription>
              Article 34 GDPR - Individual notifications for high-risk breaches
            </DialogDescription>
          </DialogHeader>
          
          {selectedBreach && (
            <div className="space-y-6">
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>High-Risk Breach Notification</AlertTitle>
                <AlertDescription>
                  This breach requires individual notification as it poses significant risk to affected data subjects.
                </AlertDescription>
              </Alert>
              
              <div>
                <label className="text-sm font-medium">Recipient Email Addresses</label>
                <p className="text-xs text-gray-500 mb-2">Enter email addresses of affected data subjects</p>
                <div className="space-y-2">
                  {recipientEmails.map((email, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          const newEmails = [...recipientEmails];
                          newEmails[index] = e.target.value;
                          setRecipientEmails(newEmails);
                        }}
                        placeholder="email@example.com"
                        className="flex-1"
                        data-testid={`input-email-${index}`}
                      />
                      {recipientEmails.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setRecipientEmails(recipientEmails.filter((_, i) => i !== index));
                          }}
                          data-testid={`button-remove-email-${index}`}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setRecipientEmails([...recipientEmails, ''])}
                    className="mt-2"
                    data-testid="button-add-email"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Email
                  </Button>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium">Additional Message (Optional)</label>
                <p className="text-xs text-gray-500 mb-2">Custom message to include with the standard notification</p>
                <Textarea
                  value={notificationMessage}
                  onChange={(e) => setNotificationMessage(e.target.value)}
                  placeholder="Enter any additional information or instructions for affected individuals..."
                  rows={3}
                  data-testid="textarea-custom-message"
                />
              </div>
              
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Notification will include:</h4>
                <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-400">
                  <li>• Description of what happened and when</li>
                  <li>• Types of personal data involved</li>
                  <li>• Steps we're taking to address the incident</li>
                  <li>• Recommended actions for the individual</li>
                  <li>• Contact information for questions</li>
                  <li>• Information about their data protection rights</li>
                </ul>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsBulkNotifyDialogOpen(false);
                setRecipientEmails(['']);
                setNotificationMessage('');
              }}
              data-testid="button-cancel-bulk"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedBreach) {
                  bulkNotifyMutation.mutate({
                    breachId: selectedBreach.id,
                    emails: recipientEmails,
                    message: notificationMessage
                  });
                }
              }}
              disabled={bulkNotifyMutation.isPending || !recipientEmails.some(email => email.trim())}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="button-confirm-bulk"
            >
              {bulkNotifyMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Sending...
                </div>
              ) : (
                <>
                  <Bell className="h-4 w-4 mr-2" />
                  Send Notifications ({recipientEmails.filter(email => email.trim()).length})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resolve Breach Dialog */}
      <Dialog open={isResolveDialogOpen} onOpenChange={setIsResolveDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-resolve">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Resolve Data Breach
            </DialogTitle>
            <DialogDescription>
              Mark this breach as resolved and closed with resolution details
            </DialogDescription>
          </DialogHeader>
          
          {selectedBreach && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Breach:</strong>
                  <p className="text-gray-600 dark:text-gray-400">{selectedBreach.title}</p>
                </div>
                <div>
                  <strong>Days Since Detection:</strong>
                  <p className="text-gray-600 dark:text-gray-400">
                    {Math.ceil((new Date().getTime() - new Date(selectedBreach.detectedAt).getTime()) / (1000 * 60 * 60 * 24))} days
                  </p>
                </div>
              </div>
              
              <form onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target as HTMLFormElement);
                resolveMutation.mutate({
                  breachId: selectedBreach.id,
                  data: {
                    resolutionNotes: formData.get('resolutionNotes'),
                    lessonsLearned: formData.get('lessonsLearned'),
                    preventiveMeasures: formData.get('preventiveMeasures')
                  }
                });
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Resolution Notes</label>
                    <Textarea
                      name="resolutionNotes"
                      placeholder="Describe how the breach was resolved..."
                      rows={3}
                      required
                      data-testid="textarea-resolution-notes"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Lessons Learned</label>
                    <Textarea
                      name="lessonsLearned"
                      placeholder="What lessons were learned from this incident?"
                      rows={3}
                      data-testid="textarea-lessons-learned"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium">Additional Preventive Measures</label>
                    <Textarea
                      name="preventiveMeasures"
                      placeholder="What additional measures will prevent similar incidents?"
                      rows={3}
                      data-testid="textarea-preventive-measures"
                    />
                  </div>
                </div>
                
                <DialogFooter className="mt-6">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsResolveDialogOpen(false)}
                    data-testid="button-cancel-resolve"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={resolveMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                    data-testid="button-confirm-resolve"
                  >
                    {resolveMutation.isPending ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Resolving...
                      </div>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Resolve Breach
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}