import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Plus, 
  Settings, 
  Trash2, 
  AlertTriangle, 
  Clock, 
  Shield,
  FileText,
  Calendar,
  Users,
  Database,
  CheckCircle,
  XCircle,
  PlayCircle,
  RotateCcw,
  Download,
  Filter,
  Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  insertDataRetentionPolicySchema, 
  type DataRetentionPolicy, 
  type DataLifecycleRecord,
  type RetentionComplianceAudit,
  type SecureDeletionCertificate,
  type InsertDataRetentionPolicy
} from "@shared/schema";

// Form validation schema for retention policies - properly configured to include all user-editable fields
type RetentionPolicyFormValues = InsertDataRetentionPolicy;

export default function DataRetention() {
  const { toast } = useToast();
  const [selectedPolicy, setSelectedPolicy] = useState<DataRetentionPolicy | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [activeTab, setActiveTab] = useState("policies");
  const [lifecycleFilter, setLifecycleFilter] = useState("all");

  // Fetch retention policies
  const { data: policies = [], isLoading: policiesLoading } = useQuery<DataRetentionPolicy[]>({
    queryKey: ['/api/gdpr/retention-policies']
  });

  // Fetch data lifecycle records
  const { data: lifecycleRecords = [], isLoading: lifecycleLoading } = useQuery<DataLifecycleRecord[]>({
    queryKey: ['/api/gdpr/data-lifecycle']
  });

  // Fetch retention status
  const { data: retentionStatus, isLoading: statusLoading } = useQuery<any>({
    queryKey: ['/api/gdpr/retention-status']
  });

  // Fetch compliance audits
  const { data: complianceAudits = [], isLoading: auditsLoading } = useQuery<RetentionComplianceAudit[]>({
    queryKey: ['/api/gdpr/retention-audits']
  });

  // Fetch deletion certificates
  const { data: deletionCertificates = [], isLoading: certificatesLoading } = useQuery<SecureDeletionCertificate[]>({
    queryKey: ['/api/gdpr/deletion-certificates']
  });

  // Create retention policy mutation
  const createPolicyMutation = useMutation({
    mutationFn: async (data: RetentionPolicyFormValues) => {
      const response = await apiRequest('POST', '/api/gdpr/retention-policies', data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/retention-policies'] });
      setShowCreateDialog(false);
      toast({
        title: "Policy Created",
        description: "Data retention policy has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create retention policy",
        variant: "destructive",
      });
    }
  });

  // Update retention policy mutation
  const updatePolicyMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RetentionPolicyFormValues> }) => {
      const response = await apiRequest('PUT', `/api/gdpr/retention-policies/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/retention-policies'] });
      setSelectedPolicy(null);
      toast({
        title: "Policy Updated",
        description: "Data retention policy has been updated successfully.",
      });
    }
  });

  // Delete retention policy mutation
  const deletePolicyMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/gdpr/retention-policies/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/retention-policies'] });
      setShowDeleteDialog(false);
      setSelectedPolicy(null);
      toast({
        title: "Policy Deleted",
        description: "Data retention policy has been deleted successfully.",
      });
    }
  });

  // Execute retention scan mutation
  const retentionScanMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/gdpr/retention-scan');
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/data-lifecycle'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/retention-status'] });
      toast({
        title: "Retention Scan Complete",
        description: `Processed ${data?.recordsProcessed || 0} records for retention compliance.`,
      });
    }
  });

  // Form setup
  const form = useForm<RetentionPolicyFormValues>({
    resolver: zodResolver(insertDataRetentionPolicySchema.omit({
      organisationId: true,
      createdBy: true
    }).extend({
      retentionPeriod: z.number().min(1, "Retention period must be at least 1 day"),
      gracePeriod: z.number().min(0, "Grace period cannot be negative")
    })),
    defaultValues: {
      name: "",
      description: "",
      dataType: "user_profile" as const,
      retentionPeriod: 365,
      gracePeriod: 30,
      deletionMethod: "soft" as const,
      secureEraseMethod: "overwrite_multiple" as const,
      triggerType: "time_based" as const,
      legalBasis: "consent" as const,
      regulatoryRequirement: null,
      priority: 100,
      enabled: true,
      automaticDeletion: true,
      requiresManualReview: false,
      notificationSettings: {},
      metadata: {}
    }
  });

  const onSubmit = (data: RetentionPolicyFormValues) => {
    createPolicyMutation.mutate(data);
  };

  // Filter lifecycle records based on status
  const filteredLifecycleRecords = lifecycleFilter === "all" 
    ? lifecycleRecords 
    : lifecycleRecords.filter((record: DataLifecycleRecord) => record.status === lifecycleFilter);

  // Data type options
  const dataTypeOptions = [
    { value: "user_profile", label: "User Personal Data" },
    { value: "user_authentication", label: "Authentication Data" },
    { value: "course_progress", label: "Course Content & Progress" },
    { value: "certificates", label: "Generated Certificates" },
    { value: "communications", label: "Messages & Communications" },
    { value: "audit_logs", label: "Audit & System Logs" },
    { value: "support_tickets", label: "Customer Support Data" },
    { value: "billing_records", label: "Payment & Subscription Data" },
    { value: "consent_records", label: "GDPR Consent Preferences" },
    { value: "analytics_data", label: "Usage Analytics Data" },
    { value: "uploaded_files", label: "Uploaded Files & Documents" },
    { value: "system_logs", label: "Technical System Logs" },
    { value: "backup_data", label: "System Backups" }
  ];

  // Legal basis options
  const legalBasisOptions = [
    { value: "consent", label: "Consent (Art. 6(1)(a))" },
    { value: "contract", label: "Contract Performance (Art. 6(1)(b))" },
    { value: "legal_obligation", label: "Legal Obligation (Art. 6(1)(c))" },
    { value: "vital_interests", label: "Vital Interests (Art. 6(1)(d))" },
    { value: "public_task", label: "Public Task (Art. 6(1)(e))" },
    { value: "legitimate_interests", label: "Legitimate Interests (Art. 6(1)(f))" }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-green-100 text-green-800";
      case "retention_pending": return "bg-yellow-100 text-yellow-800";
      case "deletion_scheduled": return "bg-orange-100 text-orange-800";
      case "soft_deleted": return "bg-orange-100 text-orange-800";
      case "deletion_pending": return "bg-red-100 text-red-800";
      case "securely_erased": return "bg-red-100 text-red-800";
      case "archived": return "bg-blue-100 text-blue-800";
      case "frozen": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (date: string | Date) => {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return dateObj.toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 p-6" data-testid="data-retention-page">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="page-title">
                Data Retention Management
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                GDPR Article 5(e) Storage Limitation Compliance
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                onClick={() => retentionScanMutation.mutate()}
                disabled={retentionScanMutation.isPending}
                variant="outline"
                data-testid="button-retention-scan"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                {retentionScanMutation.isPending ? "Scanning..." : "Run Retention Scan"}
              </Button>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button data-testid="button-create-policy">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Policy
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Create Data Retention Policy</DialogTitle>
                    <DialogDescription>
                      Define retention rules for specific data types in compliance with GDPR Article 5(e).
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Policy Name</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-policy-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="dataType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Data Type</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-data-type">
                                    <SelectValue placeholder="Select data type" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {dataTypeOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea {...field} data-testid="input-policy-description" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="retentionPeriod"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Retention Period (days)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field} 
                                  onChange={e => field.onChange(parseInt(e.target.value))}
                                  data-testid="input-retention-period"
                                />
                              </FormControl>
                              <FormDescription>
                                How long to retain data before deletion
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="gracePeriod"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Grace Period (days)</FormLabel>
                              <FormControl>
                                <Input 
                                  type="number" 
                                  {...field} 
                                  onChange={e => field.onChange(parseInt(e.target.value))}
                                  data-testid="input-grace-period"
                                />
                              </FormControl>
                              <FormDescription>
                                Time between soft-delete and secure erase
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="legalBasis"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Legal Basis</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-legal-basis">
                                  <SelectValue placeholder="Select legal basis" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {legalBasisOptions.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex items-center space-x-4">
                        <FormField
                          control={form.control}
                          name="automaticDeletion"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between">
                              <div className="space-y-0.5">
                                <FormLabel>Automatic Deletion</FormLabel>
                                <FormDescription>
                                  Enable automated deletion based on retention period
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                  data-testid="switch-automatic-deletion"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-end space-x-3 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowCreateDialog(false)}
                          data-testid="button-cancel"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          disabled={createPolicyMutation.isPending}
                          data-testid="button-create-policy-submit"
                        >
                          {createPolicyMutation.isPending ? "Creating..." : "Create Policy"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {/* Retention Status Overview */}
        {retentionStatus && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card data-testid="card-total-policies">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Policies</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-total-policies">
                  {policies.length}
                </div>
              </CardContent>
            </Card>
            
            <Card data-testid="card-active-records">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Records</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-active-records">
                  {retentionStatus.retentionStatus?.activeRecords || 0}
                </div>
              </CardContent>
            </Card>
            
            <Card data-testid="card-scheduled-deletion">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Scheduled for Deletion</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-scheduled-deletion">
                  {retentionStatus.retentionStatus?.scheduledForDeletion || 0}
                </div>
              </CardContent>
            </Card>
            
            <Card data-testid="card-compliance-score">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="text-compliance-score">
                  {retentionStatus.retentionStatus?.complianceScore || 100}%
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="policies" data-testid="tab-policies">Retention Policies</TabsTrigger>
            <TabsTrigger value="lifecycle" data-testid="tab-lifecycle">Data Lifecycle</TabsTrigger>
            <TabsTrigger value="audits" data-testid="tab-audits">Compliance Audits</TabsTrigger>
            <TabsTrigger value="certificates" data-testid="tab-certificates">Deletion Certificates</TabsTrigger>
          </TabsList>

          {/* Retention Policies Tab */}
          <TabsContent value="policies" className="space-y-4">
            <Card data-testid="card-retention-policies">
              <CardHeader>
                <CardTitle>Data Retention Policies</CardTitle>
                <CardDescription>
                  Manage automated data lifecycle policies for GDPR compliance
                </CardDescription>
              </CardHeader>
              <CardContent>
                {policiesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">Loading policies...</div>
                  </div>
                ) : policies.length === 0 ? (
                  <div className="text-center py-8">
                    <Shield className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No retention policies</h3>
                    <p className="mt-1 text-sm text-gray-500">Get started by creating your first retention policy.</p>
                    <div className="mt-6">
                      <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-first-policy">
                        <Plus className="w-4 h-4 mr-2" />
                        Create Policy
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {policies.map((policy: DataRetentionPolicy) => (
                      <Card key={policy.id} className="border-l-4 border-l-blue-500" data-testid={`card-policy-${policy.id}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-lg" data-testid={`text-policy-name-${policy.id}`}>
                                {policy.name}
                              </CardTitle>
                              <CardDescription data-testid={`text-policy-description-${policy.id}`}>
                                {policy.description}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={policy.enabled ? "default" : "secondary"} data-testid={`badge-policy-status-${policy.id}`}>
                                {policy.enabled ? "Active" : "Inactive"}
                              </Badge>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedPolicy(policy)}
                                data-testid={`button-edit-policy-${policy.id}`}
                              >
                                <Settings className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <Label className="text-muted-foreground">Data Type</Label>
                              <div className="font-medium" data-testid={`text-policy-data-type-${policy.id}`}>
                                {dataTypeOptions.find(opt => opt.value === policy.dataType)?.label || policy.dataType}
                              </div>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Retention Period</Label>
                              <div className="font-medium" data-testid={`text-policy-retention-${policy.id}`}>
                                {policy.retentionPeriod} days
                              </div>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Grace Period</Label>
                              <div className="font-medium" data-testid={`text-policy-grace-${policy.id}`}>
                                {policy.gracePeriod} days
                              </div>
                            </div>
                            <div>
                              <Label className="text-muted-foreground">Legal Basis</Label>
                              <div className="font-medium" data-testid={`text-policy-legal-basis-${policy.id}`}>
                                {legalBasisOptions.find(opt => opt.value === policy.legalBasis)?.label || policy.legalBasis}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data Lifecycle Tab */}
          <TabsContent value="lifecycle" className="space-y-4">
            <Card data-testid="card-data-lifecycle">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Data Lifecycle Records</CardTitle>
                    <CardDescription>
                      Track data through its retention lifecycle from active to secure erasure
                    </CardDescription>
                  </div>
                  <Select value={lifecycleFilter} onValueChange={setLifecycleFilter}>
                    <SelectTrigger className="w-48" data-testid="select-lifecycle-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Records</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="scheduled_for_deletion">Scheduled for Deletion</SelectItem>
                      <SelectItem value="soft_deleted">Soft Deleted</SelectItem>
                      <SelectItem value="securely_erased">Securely Erased</SelectItem>
                      <SelectItem value="retained">Retained</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {lifecycleLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">Loading lifecycle records...</div>
                  </div>
                ) : filteredLifecycleRecords.length === 0 ? (
                  <div className="text-center py-8">
                    <Database className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No lifecycle records</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      {lifecycleFilter === "all" 
                        ? "No data lifecycle records found." 
                        : `No records with status "${lifecycleFilter}".`}
                    </p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data Type</TableHead>
                        <TableHead>Entity ID</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Scheduled Deletion</TableHead>
                        <TableHead>Policy</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLifecycleRecords.map((record: DataLifecycleRecord) => (
                        <TableRow key={record.id} data-testid={`row-lifecycle-${record.id}`}>
                          <TableCell data-testid={`text-lifecycle-data-type-${record.id}`}>
                            {record.dataType}
                          </TableCell>
                          <TableCell className="font-mono text-sm" data-testid={`text-lifecycle-entity-${record.id}`}>
                            {record.resourceId.substring(0, 8)}...
                          </TableCell>
                          <TableCell>
                            <Badge 
                              className={getStatusColor(record.status)}
                              data-testid={`badge-lifecycle-status-${record.id}`}
                            >
                              {record.status.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell data-testid={`text-lifecycle-scheduled-${record.id}`}>
                            {record.softDeleteScheduledAt ? formatDate(record.softDeleteScheduledAt) : "-"}
                          </TableCell>
                          <TableCell data-testid={`text-lifecycle-policy-${record.id}`}>
                            {record.policyId}
                          </TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" data-testid={`button-view-lifecycle-${record.id}`}>
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Compliance Audits Tab */}
          <TabsContent value="audits" className="space-y-4">
            <Card data-testid="card-compliance-audits">
              <CardHeader>
                <CardTitle>Retention Compliance Audits</CardTitle>
                <CardDescription>
                  Detailed audit trail of all retention policy operations and compliance activities
                </CardDescription>
              </CardHeader>
              <CardContent>
                {auditsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">Loading compliance audits...</div>
                  </div>
                ) : complianceAudits.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No compliance audits</h3>
                    <p className="mt-1 text-sm text-gray-500">Compliance audit records will appear here.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Operation</TableHead>
                        <TableHead>Policy</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {complianceAudits.map((audit: RetentionComplianceAudit) => (
                        <TableRow key={audit.id} data-testid={`row-audit-${audit.id}`}>
                          <TableCell data-testid={`text-audit-timestamp-${audit.id}`}>
                            {formatDate(audit.auditDate)}
                          </TableCell>
                          <TableCell data-testid={`text-audit-operation-${audit.id}`}>
                            Compliance Audit
                          </TableCell>
                          <TableCell data-testid={`text-audit-policy-${audit.id}`}>
                            {audit.policyId}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={audit.isCompliant ? 'default' : 'destructive'}
                              data-testid={`badge-audit-status-${audit.id}`}
                            >
                              {audit.isCompliant ? 'Compliant' : 'Non-Compliant'}
                            </Badge>
                          </TableCell>
                          <TableCell data-testid={`text-audit-details-${audit.id}`}>
                            <Button variant="outline" size="sm">
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Deletion Certificates Tab */}
          <TabsContent value="certificates" className="space-y-4">
            <Card data-testid="card-deletion-certificates">
              <CardHeader>
                <CardTitle>Secure Deletion Certificates</CardTitle>
                <CardDescription>
                  DOD 5220.22-M compliant deletion certificates for securely erased data
                </CardDescription>
              </CardHeader>
              <CardContent>
                {certificatesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-muted-foreground">Loading deletion certificates...</div>
                  </div>
                ) : deletionCertificates.length === 0 ? (
                  <div className="text-center py-8">
                    <Shield className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No deletion certificates</h3>
                    <p className="mt-1 text-sm text-gray-500">Secure deletion certificates will appear here after data is erased.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Certificate Number</TableHead>
                        <TableHead>Data Type</TableHead>
                        <TableHead>Deletion Method</TableHead>
                        <TableHead>Verified At</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deletionCertificates.map((cert: SecureDeletionCertificate) => (
                        <TableRow key={cert.id} data-testid={`row-certificate-${cert.id}`}>
                          <TableCell className="font-mono" data-testid={`text-cert-number-${cert.id}`}>
                            {cert.certificateNumber}
                          </TableCell>
                          <TableCell data-testid={`text-cert-data-type-${cert.id}`}>
                            {cert.dataTypes.join(', ')}
                          </TableCell>
                          <TableCell data-testid={`text-cert-method-${cert.id}`}>
                            {cert.deletionMethod}
                          </TableCell>
                          <TableCell data-testid={`text-cert-verified-${cert.id}`}>
                            {formatDate(cert.deletionCompleted)}
                          </TableCell>
                          <TableCell>
                            <Button variant="outline" size="sm" data-testid={`button-download-cert-${cert.id}`}>
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Policy Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Retention Policy</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this retention policy? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end space-x-3 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                data-testid="button-cancel-delete"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => selectedPolicy && deletePolicyMutation.mutate(selectedPolicy.id)}
                disabled={deletePolicyMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deletePolicyMutation.isPending ? "Deleting..." : "Delete Policy"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}