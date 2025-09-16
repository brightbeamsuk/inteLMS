import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsGdprEnabled } from "@/hooks/useGdpr";
import { 
  type ProcessingActivity, 
  type InsertProcessingActivity,
  insertProcessingActivitySchema,
  processingLawfulBasisEnum
} from "@shared/schema";
import { z } from "zod";
import { format } from "date-fns";
import { 
  FileText, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  Download, 
  Search,
  Filter,
  MoreHorizontal,
  Shield,
  Database,
  Globe,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  FileDown,
  Settings,
  Scale
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

// Lawful basis information for Article 30 compliance
const lawfulBasisInfo = {
  consent: {
    title: "Consent",
    icon: Users,
    article: "Article 6(1)(a)",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    description: "The data subject has given consent to the processing"
  },
  contract: {
    title: "Contract", 
    icon: FileText,
    article: "Article 6(1)(b)",
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    description: "Processing necessary for contract performance"
  },
  legal_obligation: {
    title: "Legal Obligation",
    icon: Scale,
    article: "Article 6(1)(c)", 
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
    description: "Processing necessary for compliance with legal obligation"
  },
  vital_interests: {
    title: "Vital Interests",
    icon: Shield,
    article: "Article 6(1)(d)",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", 
    description: "Processing necessary to protect vital interests"
  },
  public_task: {
    title: "Public Task",
    icon: Settings,
    article: "Article 6(1)(e)",
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    description: "Processing necessary for public task or official authority"
  },
  legitimate_interests: {
    title: "Legitimate Interests", 
    icon: Database,
    article: "Article 6(1)(f)",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    description: "Processing necessary for legitimate interests"
  }
};

// Pre-defined data categories for Article 30 compliance
const dataCategories = [
  "Identity data (names, titles, aliases, photographs)",
  "Contact data (addresses, email addresses, telephone numbers)",
  "Financial data (bank details, payment information, credit/debit card data)",
  "Transaction data (details about payments and services)", 
  "Technical data (IP addresses, login data, browser type, device information)",
  "Profile data (username, password, preferences, feedback)",
  "Usage data (information about how you use our services)",
  "Marketing data (preferences for receiving marketing communications)",
  "Special category data (racial, ethnic origin, political opinions, religious beliefs)",
  "Criminal conviction data (criminal convictions and offences)"
];

// Pre-defined data subject categories
const dataSubjectCategories = [
  "Website visitors",
  "Service users/customers", 
  "Employees (current and former)",
  "Job applicants",
  "Suppliers and vendors",
  "Students/learners",
  "Course instructors/trainers",
  "Business contacts",
  "Newsletter subscribers",
  "Social media followers"
];

// Pre-defined recipient categories
const recipientCategories = [
  "Internal staff and departments",
  "IT service providers", 
  "Payment processors",
  "Marketing service providers",
  "Analytics providers",
  "Legal and professional advisers",
  "Regulatory and government bodies",
  "Insurance providers",
  "Audit and accounting firms",
  "Cloud storage providers"
];

// Pre-defined security measures
const securityMeasures = [
  "Encryption at rest and in transit",
  "Access controls and authentication",
  "Regular security assessments",
  "Staff training and awareness",
  "Incident response procedures", 
  "Data backup and recovery",
  "Network security controls",
  "Physical security measures",
  "Vendor security assessments",
  "Data minimization practices"
];

export default function RegisterOfProcessing() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isGdprEnabled = useIsGdprEnabled();

  const [searchTerm, setSearchTerm] = useState("");
  const [filterLawfulBasis, setFilterLawfulBasis] = useState<string>("");
  const [showInternationalOnly, setShowInternationalOnly] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<ProcessingActivity | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  // Form state for create/edit
  const [formData, setFormData] = useState<Partial<InsertProcessingActivity>>({
    name: "",
    purpose: "",
    description: "",
    lawfulBasis: "consent",
    dataCategories: [],
    dataSubjects: [],
    recipients: [],
    internationalTransfers: false,
    transferCountries: [],
    retentionPeriod: "",
    securityMeasures: [],
    dpia: { required: false, completed: false }
  });

  // GDPR feature flag check
  if (!isGdprEnabled) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Register of Processing Activities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <AlertTriangle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">GDPR Module Not Enabled</h3>
              <p className="text-muted-foreground">
                The Register of Processing Activities is not available in this configuration.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // RBAC check - only admin/superadmin can access
  if (user?.role !== 'admin' && user?.role !== 'superadmin') {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Access Restricted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Shield className="mx-auto h-12 w-12 text-red-500 mb-4" />
              <h3 className="text-lg font-medium mb-2">Admin Access Required</h3>
              <p className="text-muted-foreground">
                You need administrator privileges to access the Register of Processing Activities.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Query parameters for filtering
  const queryParams = new URLSearchParams();
  if (searchTerm) queryParams.append('search', searchTerm);
  if (filterLawfulBasis) queryParams.append('lawfulBasis', filterLawfulBasis);
  if (showInternationalOnly) queryParams.append('internationalTransfers', 'true');

  // Fetch processing activities
  const { data: activities, isLoading } = useQuery<ProcessingActivity[]>({
    queryKey: ['/api/gdpr/processing-activities', queryParams.toString()],
    queryFn: () => apiRequest('GET', `/api/gdpr/processing-activities?${queryParams.toString()}`).then(res => res.json()),
  });

  // Create processing activity mutation
  const createActivityMutation = useMutation({
    mutationFn: async (data: InsertProcessingActivity) => {
      return await apiRequest('POST', '/api/gdpr/processing-activities', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/processing-activities'] });
      toast({
        title: "Success",
        description: "Processing activity created successfully",
      });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create processing activity",
        variant: "destructive",
      });
    }
  });

  // Update processing activity mutation
  const updateActivityMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertProcessingActivity> }) => {
      return await apiRequest('PUT', `/api/gdpr/processing-activities/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/processing-activities'] });
      toast({
        title: "Success", 
        description: "Processing activity updated successfully",
      });
      setIsEditDialogOpen(false);
      setSelectedActivity(null);
      resetForm();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update processing activity",
        variant: "destructive",
      });
    }
  });

  // Delete processing activity mutation
  const deleteActivityMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/gdpr/processing-activities/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/processing-activities'] });
      toast({
        title: "Success",
        description: "Processing activity deleted successfully",
      });
      setIsDeleteDialogOpen(false);
      setSelectedActivity(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to delete processing activity",
        variant: "destructive",
      });
    }
  });

  // Export processing activities
  const exportActivities = async (format: 'json' | 'csv') => {
    try {
      const response = await fetch(`/api/gdpr/processing-activities/export?format=${format}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`, // Adjust based on your auth implementation
        }
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ropa_export_${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Success",
        description: `Register of Processing Activities exported as ${format.toUpperCase()}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export processing activities",
        variant: "destructive",
      });
    }
  };

  // Form helpers
  const resetForm = () => {
    setFormData({
      name: "",
      purpose: "",
      description: "",
      lawfulBasis: "consent",
      dataCategories: [],
      dataSubjects: [],
      recipients: [],
      internationalTransfers: false,
      transferCountries: [],
      retentionPeriod: "",
      securityMeasures: [],
      dpia: { required: false, completed: false }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Validate form data
      const validationResult = insertProcessingActivitySchema.omit({ organisationId: true }).safeParse(formData);
      
      if (!validationResult.success) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields correctly",
          variant: "destructive",
        });
        return;
      }

      if (selectedActivity) {
        // Update existing activity
        updateActivityMutation.mutate({
          id: selectedActivity.id,
          data: validationResult.data
        });
      } else {
        // Create new activity
        createActivityMutation.mutate(validationResult.data as InsertProcessingActivity);
      }
    } catch (error) {
      toast({
        title: "Error", 
        description: "Please check your form data and try again",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (activity: ProcessingActivity) => {
    setSelectedActivity(activity);
    setFormData({
      name: activity.name,
      purpose: activity.purpose,
      description: activity.description,
      lawfulBasis: activity.lawfulBasis,
      dataCategories: activity.dataCategories,
      dataSubjects: activity.dataSubjects,
      recipients: activity.recipients,
      internationalTransfers: activity.internationalTransfers,
      transferCountries: activity.transferCountries,
      retentionPeriod: activity.retentionPeriod,
      securityMeasures: activity.securityMeasures,
      dpia: activity.dpia as any
    });
    setIsEditDialogOpen(true);
  };

  const openViewDialog = (activity: ProcessingActivity) => {
    setSelectedActivity(activity);
    setIsViewDialogOpen(true);
  };

  const openDeleteDialog = (activity: ProcessingActivity) => {
    setSelectedActivity(activity);
    setIsDeleteDialogOpen(true);
  };

  const handleArrayFieldChange = (field: keyof InsertProcessingActivity, value: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: checked 
        ? [...((prev[field] as string[]) || []), value]
        : ((prev[field] as string[]) || []).filter(item => item !== value)
    }));
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Register of Processing Activities
          </h1>
          <p className="text-muted-foreground">
            Article 30 GDPR Compliance - Maintain records of all data processing activities
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="button-export-ropa">
                <FileDown className="h-4 w-4 mr-2" />
                Export RoPA
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportActivities('json')} data-testid="button-export-json">
                <FileText className="h-4 w-4 mr-2" />
                Export as JSON
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportActivities('csv')} data-testid="button-export-csv">
                <Database className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button 
            onClick={() => {
              resetForm();
              setIsCreateDialogOpen(true);
            }}
            data-testid="button-create-activity"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Activity
          </Button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Activities</p>
                <p className="text-2xl font-bold" data-testid="text-total-activities">{activities?.length || 0}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">International Transfers</p>
                <p className="text-2xl font-bold" data-testid="text-international-transfers">
                  {activities?.filter(a => a.internationalTransfers).length || 0}
                </p>
              </div>
              <Globe className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">DPIA Required</p>
                <p className="text-2xl font-bold" data-testid="text-dpia-required">
                  {activities?.filter(a => (a.dpia as any)?.required).length || 0}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
                <p className="text-sm font-medium" data-testid="text-last-updated">
                  {(activities && activities.length > 0) ? format(new Date(Math.max(...activities.map(a => new Date(a.updatedAt || a.createdAt!).getTime()))), 'MMM dd, yyyy') : 'Never'}
                </p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search processing activities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
            </div>
            
            <Select value={filterLawfulBasis} onValueChange={setFilterLawfulBasis}>
              <SelectTrigger className="w-[200px]" data-testid="select-lawful-basis">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by lawful basis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All lawful bases</SelectItem>
                {Object.entries(lawfulBasisInfo).map(([key, info]) => (
                  <SelectItem key={key} value={key} data-testid={`option-lawful-basis-${key}`}>
                    {info.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center space-x-2">
              <Switch
                id="international-transfers"
                checked={showInternationalOnly}
                onCheckedChange={setShowInternationalOnly}
                data-testid="switch-international-only"
              />
              <Label htmlFor="international-transfers">International transfers only</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Processing Activities Table */}
      <Card>
        <CardHeader>
          <CardTitle>Processing Activities</CardTitle>
          <CardDescription>
            All processing activities must be documented for Article 30 compliance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading processing activities...</p>
            </div>
          ) : activities && activities.length > 0 ? (
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activity Name</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Lawful Basis</TableHead>
                    <TableHead>International Transfers</TableHead>
                    <TableHead>DPIA</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activities.map((activity) => {
                    const lawfulBasis = lawfulBasisInfo[activity.lawfulBasis as keyof typeof lawfulBasisInfo];
                    const Icon = lawfulBasis.icon;
                    
                    return (
                      <TableRow key={activity.id} data-testid={`row-activity-${activity.id}`}>
                        <TableCell className="font-medium" data-testid={`text-activity-name-${activity.id}`}>
                          {activity.name}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate" data-testid={`text-activity-purpose-${activity.id}`}>
                          {activity.purpose}
                        </TableCell>
                        <TableCell>
                          <Badge className={lawfulBasis.color} data-testid={`badge-lawful-basis-${activity.id}`}>
                            <Icon className="h-3 w-3 mr-1" />
                            {lawfulBasis.title}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {activity.internationalTransfers ? (
                            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" data-testid={`badge-international-yes-${activity.id}`}>
                              <Globe className="h-3 w-3 mr-1" />
                              Yes
                            </Badge>
                          ) : (
                            <Badge variant="secondary" data-testid={`badge-international-no-${activity.id}`}>No</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {activity.dpia?.required ? (
                            <Badge className={activity.dpia.completed ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"} data-testid={`badge-dpia-${activity.id}`}>
                              {activity.dpia.completed ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                              {activity.dpia.completed ? 'Complete' : 'Required'}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" data-testid={`badge-dpia-not-required-${activity.id}`}>Not Required</Badge>
                          )}
                        </TableCell>
                        <TableCell data-testid={`text-updated-${activity.id}`}>
                          {format(new Date(activity.updatedAt || activity.createdAt!), 'MMM dd, yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" data-testid={`button-actions-${activity.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem 
                                onClick={() => openViewDialog(activity)}
                                data-testid={`button-view-${activity.id}`}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => openEditDialog(activity)}
                                data-testid={`button-edit-${activity.id}`}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => openDeleteDialog(activity)}
                                className="text-red-600"
                                data-testid={`button-delete-${activity.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Processing Activities</h3>
              <p className="text-muted-foreground mb-4">
                Start building your Article 30 compliance register by adding your first processing activity.
              </p>
              <Button 
                onClick={() => {
                  resetForm();
                  setIsCreateDialogOpen(true);
                }}
                data-testid="button-add-first-activity"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Activity
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Activity Dialog */}
      <Dialog open={isCreateDialogOpen || isEditDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setIsCreateDialogOpen(false);
          setIsEditDialogOpen(false);
          setSelectedActivity(null);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-activity-form">
          <DialogHeader>
            <DialogTitle>
              {selectedActivity ? 'Edit Processing Activity' : 'Create Processing Activity'}
            </DialogTitle>
            <DialogDescription>
              Document all details required for Article 30 GDPR compliance
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="basic">Basic Info</TabsTrigger>
                <TabsTrigger value="data">Data Details</TabsTrigger>
                <TabsTrigger value="recipients">Recipients</TabsTrigger>
                <TabsTrigger value="security">Security & DPIA</TabsTrigger>
              </TabsList>

              {/* Basic Information Tab */}
              <TabsContent value="basic" className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <Label htmlFor="name">Activity Name *</Label>
                    <Input
                      id="name"
                      value={formData.name || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Customer Registration Process"
                      required
                      data-testid="input-activity-name"
                    />
                  </div>

                  <div>
                    <Label htmlFor="purpose">Purpose of Processing *</Label>
                    <Textarea
                      id="purpose"
                      value={formData.purpose || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
                      placeholder="Describe the purpose and objectives of this processing activity..."
                      required
                      data-testid="textarea-purpose"
                    />
                  </div>

                  <div>
                    <Label htmlFor="description">Detailed Description *</Label>
                    <Textarea
                      id="description"
                      value={formData.description || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Provide a comprehensive description of the processing activity..."
                      required
                      data-testid="textarea-description"
                    />
                  </div>

                  <div>
                    <Label htmlFor="lawfulBasis">Lawful Basis *</Label>
                    <Select
                      value={formData.lawfulBasis || 'consent'}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, lawfulBasis: value as any }))}
                    >
                      <SelectTrigger data-testid="select-lawful-basis-form">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(lawfulBasisInfo).map(([key, info]) => {
                          const Icon = info.icon;
                          return (
                            <SelectItem key={key} value={key} data-testid={`option-lawful-basis-form-${key}`}>
                              <div className="flex items-center">
                                <Icon className="h-4 w-4 mr-2" />
                                <div>
                                  <div className="font-medium">{info.title}</div>
                                  <div className="text-xs text-muted-foreground">{info.article}</div>
                                </div>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="retentionPeriod">Data Retention Period *</Label>
                    <Input
                      id="retentionPeriod"
                      value={formData.retentionPeriod || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, retentionPeriod: e.target.value }))}
                      placeholder="e.g., 7 years after contract termination"
                      required
                      data-testid="input-retention-period"
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Data Details Tab */}
              <TabsContent value="data" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Data Categories *</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                      {dataCategories.map((category) => (
                        <div key={category} className="flex items-center space-x-2">
                          <Checkbox
                            id={`data-category-${category}`}
                            checked={(formData.dataCategories || []).includes(category)}
                            onCheckedChange={(checked) => handleArrayFieldChange('dataCategories', category, checked as boolean)}
                            data-testid={`checkbox-data-category-${category.replace(/\s+/g, '-').toLowerCase()}`}
                          />
                          <Label htmlFor={`data-category-${category}`} className="text-sm">
                            {category}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Data Subject Categories *</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                      {dataSubjectCategories.map((subject) => (
                        <div key={subject} className="flex items-center space-x-2">
                          <Checkbox
                            id={`data-subject-${subject}`}
                            checked={(formData.dataSubjects || []).includes(subject)}
                            onCheckedChange={(checked) => handleArrayFieldChange('dataSubjects', subject, checked as boolean)}
                            data-testid={`checkbox-data-subject-${subject.replace(/\s+/g, '-').toLowerCase()}`}
                          />
                          <Label htmlFor={`data-subject-${subject}`} className="text-sm">
                            {subject}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Recipients Tab */}
              <TabsContent value="recipients" className="space-y-4">
                <div className="space-y-6">
                  <div>
                    <Label>Recipient Categories *</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                      {recipientCategories.map((recipient) => (
                        <div key={recipient} className="flex items-center space-x-2">
                          <Checkbox
                            id={`recipient-${recipient}`}
                            checked={(formData.recipients || []).includes(recipient)}
                            onCheckedChange={(checked) => handleArrayFieldChange('recipients', recipient, checked as boolean)}
                            data-testid={`checkbox-recipient-${recipient.replace(/\s+/g, '-').toLowerCase()}`}
                          />
                          <Label htmlFor={`recipient-${recipient}`} className="text-sm">
                            {recipient}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="international-transfers-form"
                        checked={formData.internationalTransfers || false}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, internationalTransfers: checked }))}
                        data-testid="switch-international-transfers"
                      />
                      <Label htmlFor="international-transfers-form" className="flex items-center gap-2">
                        <Globe className="h-4 w-4" />
                        International Transfers
                      </Label>
                    </div>

                    {formData.internationalTransfers && (
                      <div>
                        <Label htmlFor="transferCountries">Transfer Countries</Label>
                        <Input
                          id="transferCountries"
                          value={(formData.transferCountries || []).join(', ')}
                          onChange={(e) => setFormData(prev => ({ 
                            ...prev, 
                            transferCountries: e.target.value.split(',').map(c => c.trim()).filter(c => c)
                          }))}
                          placeholder="e.g., USA, Canada, Japan"
                          data-testid="input-transfer-countries"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Security & DPIA Tab */}
              <TabsContent value="security" className="space-y-4">
                <div className="space-y-6">
                  <div>
                    <Label>Security Measures *</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                      {securityMeasures.map((measure) => (
                        <div key={measure} className="flex items-center space-x-2">
                          <Checkbox
                            id={`security-${measure}`}
                            checked={(formData.securityMeasures || []).includes(measure)}
                            onCheckedChange={(checked) => handleArrayFieldChange('securityMeasures', measure, checked as boolean)}
                            data-testid={`checkbox-security-${measure.replace(/\s+/g, '-').toLowerCase()}`}
                          />
                          <Label htmlFor={`security-${measure}`} className="text-sm">
                            {measure}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h4 className="font-medium flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Data Protection Impact Assessment (DPIA)
                    </h4>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="dpia-required"
                        checked={formData.dpia?.required || false}
                        onCheckedChange={(checked) => setFormData(prev => ({ 
                          ...prev, 
                          dpia: { ...prev.dpia, required: checked }
                        }))}
                        data-testid="switch-dpia-required"
                      />
                      <Label htmlFor="dpia-required">DPIA Required</Label>
                    </div>

                    {formData.dpia?.required && (
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="dpia-completed"
                          checked={formData.dpia?.completed || false}
                          onCheckedChange={(checked) => setFormData(prev => ({ 
                            ...prev, 
                            dpia: { ...prev.dpia, completed: checked }
                          }))}
                          data-testid="switch-dpia-completed"
                        />
                        <Label htmlFor="dpia-completed">DPIA Completed</Label>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  setIsEditDialogOpen(false);
                  setSelectedActivity(null);
                  resetForm();
                }}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createActivityMutation.isPending || updateActivityMutation.isPending}
                data-testid="button-save"
              >
                {createActivityMutation.isPending || updateActivityMutation.isPending ? 'Saving...' : 'Save Activity'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Activity Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="dialog-view-activity">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Processing Activity Details
            </DialogTitle>
            <DialogDescription>
              Article 30 GDPR Compliance Record
            </DialogDescription>
          </DialogHeader>

          {selectedActivity && (
            <div className="space-y-6">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="data">Data</TabsTrigger>
                  <TabsTrigger value="recipients">Recipients</TabsTrigger>
                  <TabsTrigger value="compliance">Compliance</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Activity Name</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="font-medium" data-testid="text-view-activity-name">{selectedActivity.name}</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Lawful Basis</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Badge className={lawfulBasisInfo[selectedActivity.lawfulBasis as keyof typeof lawfulBasisInfo].color}>
                          {lawfulBasisInfo[selectedActivity.lawfulBasis as keyof typeof lawfulBasisInfo].title}
                        </Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {lawfulBasisInfo[selectedActivity.lawfulBasis as keyof typeof lawfulBasisInfo].article}
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="md:col-span-2">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Purpose of Processing</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p data-testid="text-view-purpose">{selectedActivity.purpose}</p>
                      </CardContent>
                    </Card>

                    <Card className="md:col-span-2">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Description</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p data-testid="text-view-description">{selectedActivity.description}</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Retention Period</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p data-testid="text-view-retention">{selectedActivity.retentionPeriod}</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Last Updated</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p data-testid="text-view-updated">{format(new Date(selectedActivity.updatedAt || selectedActivity.createdAt!), 'MMM dd, yyyy HH:mm')}</p>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="data" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Data Categories</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1">
                          {selectedActivity.dataCategories.map((category) => (
                            <Badge key={category} variant="secondary" className="mr-1 mb-1" data-testid={`badge-view-data-category-${category.replace(/\s+/g, '-').toLowerCase()}`}>
                              {category}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Data Subjects</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1">
                          {selectedActivity.dataSubjects.map((subject) => (
                            <Badge key={subject} variant="outline" className="mr-1 mb-1" data-testid={`badge-view-data-subject-${subject.replace(/\s+/g, '-').toLowerCase()}`}>
                              {subject}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>

                <TabsContent value="recipients" className="space-y-4">
                  <div className="space-y-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Recipients</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1">
                          {selectedActivity.recipients.map((recipient) => (
                            <Badge key={recipient} variant="outline" className="mr-1 mb-1" data-testid={`badge-view-recipient-${recipient.replace(/\s+/g, '-').toLowerCase()}`}>
                              {recipient}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {selectedActivity.internationalTransfers && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Globe className="h-4 w-4" />
                            International Transfers
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-1">
                            {selectedActivity.transferCountries.map((country) => (
                              <Badge key={country} className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 mr-1 mb-1" data-testid={`badge-view-transfer-country-${country.replace(/\s+/g, '-').toLowerCase()}`}>
                                {country}
                              </Badge>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="compliance" className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Security Measures</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1">
                          {selectedActivity.securityMeasures.map((measure) => (
                            <Badge key={measure} variant="secondary" className="mr-1 mb-1" data-testid={`badge-view-security-${measure.replace(/\s+/g, '-').toLowerCase()}`}>
                              {measure}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          DPIA Status
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">Required:</span>
                            <Badge variant={selectedActivity.dpia?.required ? "default" : "secondary"} data-testid="badge-view-dpia-required">
                              {selectedActivity.dpia?.required ? 'Yes' : 'No'}
                            </Badge>
                          </div>
                          {selectedActivity.dpia?.required && (
                            <div className="flex items-center gap-2">
                              <span className="text-sm">Completed:</span>
                              <Badge 
                                className={selectedActivity.dpia.completed ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"}
                                data-testid="badge-view-dpia-completed"
                              >
                                {selectedActivity.dpia.completed ? 'Yes' : 'No'}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)} data-testid="button-close-view">
              Close
            </Button>
            {selectedActivity && (
              <Button onClick={() => {
                setIsViewDialogOpen(false);
                openEditDialog(selectedActivity);
              }} data-testid="button-edit-from-view">
                <Edit className="h-4 w-4 mr-2" />
                Edit Activity
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent data-testid="dialog-delete-confirmation">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Delete Processing Activity
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. The processing activity and all its compliance records will be permanently deleted.
            </DialogDescription>
          </DialogHeader>

          {selectedActivity && (
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-red-900 dark:text-red-100">
                {selectedActivity.name}
              </h4>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {selectedActivity.purpose}
              </p>
            </div>
          )}

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => selectedActivity && deleteActivityMutation.mutate(selectedActivity.id)}
              disabled={deleteActivityMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteActivityMutation.isPending ? 'Deleting...' : 'Delete Activity'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}