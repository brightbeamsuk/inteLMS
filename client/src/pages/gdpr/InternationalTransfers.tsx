import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsGdprEnabled } from "@/hooks/useGdpr";
import { type InternationalTransfer, type TransferImpactAssessment, type AdequacyDecision } from "@shared/schema";
import { format, formatDistanceToNow, isAfter, isBefore } from "date-fns";
import { 
  Globe, 
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
  Activity,
  MapPin,
  Scale,
  Lock,
  Unlock,
  Flag,
  Building,
  Gavel,
  ClipboardCheck,
  HelpCircle,
  Briefcase,
  FileCheck,
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

// Risk level styling information
const riskLevelInfo = {
  low: {
    title: "Low Risk",
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    icon: CheckCircle,
    description: "Adequate safeguards in place"
  },
  medium: {
    title: "Medium Risk", 
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    icon: AlertTriangle,
    description: "Some risk factors present, monitoring required"
  },
  high: {
    title: "High Risk",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    icon: AlertCircle,
    description: "Significant risk, TIA required"
  },
  very_high: {
    title: "Very High Risk",
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    icon: XCircle,
    description: "Critical risk, immediate action required"
  }
};

// Transfer status information
const transferStatusInfo = {
  draft: {
    title: "Draft",
    icon: Edit,
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
  },
  active: {
    title: "Active",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
  },
  suspended: {
    title: "Suspended",
    icon: Clock,
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
  },
  terminated: {
    title: "Terminated",
    icon: XCircle,
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
  },
  under_review: {
    title: "Under Review",
    icon: Eye,
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
  }
};

// TIA status information
const tiaStatusInfo = {
  draft: {
    title: "Draft",
    icon: Edit,
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
  },
  under_review: {
    title: "Under Review",
    icon: Eye,
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
  },
  requires_revision: {
    title: "Requires Revision",
    icon: AlertTriangle,
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
  },
  approved: {
    title: "Approved",
    icon: CheckCircle,
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
  },
  rejected: {
    title: "Rejected",
    icon: XCircle,
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
  }
};

// Legal basis options for international transfers
const legalBasisOptions = [
  { value: "adequacy_decision", label: "Adequacy Decision", description: "EU Commission adequacy decision in place" },
  { value: "appropriate_safeguards", label: "Appropriate Safeguards", description: "SCCs, BCRs, or approved codes/certifications" },
  { value: "explicit_consent", label: "Explicit Consent", description: "Data subject's explicit consent for specific transfer" },
  { value: "contract_performance", label: "Contract Performance", description: "Necessary for contract performance" },
  { value: "public_interest", label: "Public Interest", description: "Important reasons of public interest" },
  { value: "legal_claims", label: "Legal Claims", description: "Establishment, exercise or defence of legal claims" },
  { value: "vital_interests", label: "Vital Interests", description: "Protection of vital interests" },
  { value: "public_register", label: "Public Register", description: "Transfer from public register" }
];

// Transfer mechanism options
const transferMechanismOptions = [
  { value: "standard_contractual_clauses", label: "Standard Contractual Clauses (SCCs)" },
  { value: "binding_corporate_rules", label: "Binding Corporate Rules (BCRs)" },
  { value: "adequacy_decision", label: "Adequacy Decision" },
  { value: "approved_code_conduct", label: "Approved Code of Conduct" },
  { value: "approved_certification", label: "Approved Certification Scheme" },
  { value: "international_agreement", label: "International Agreement" },
  { value: "other", label: "Other Appropriate Safeguards" }
];

// Data categories for transfer risk assessment
const dataCategories = [
  "Personal identifiers (name, ID numbers)",
  "Contact information (email, phone, address)",
  "Financial information (payment data, bank details)",
  "Health data (medical records, fitness data)",
  "Biometric data (fingerprints, facial recognition)",
  "Location data (GPS, IP addresses)",
  "Online identifiers (cookies, device IDs)",
  "Behavioural data (browsing history, preferences)",
  "Employment data (HR records, performance)",
  "Education data (academic records, qualifications)",
  "Criminal conviction data",
  "Racial or ethnic origin",
  "Political opinions",
  "Religious or philosophical beliefs",
  "Trade union membership",
  "Genetic data",
  "Data concerning sexual orientation"
];

// Form validation schemas
const transferFormSchema = z.object({
  transferName: z.string().min(1, "Transfer name is required"),
  destinationCountry: z.string().min(2, "Destination country is required"),
  legalBasis: z.string().min(1, "Legal basis is required"),
  transferMechanism: z.string().min(1, "Transfer mechanism is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  dataCategories: z.array(z.string()).min(1, "At least one data category must be selected"),
  dataSubjects: z.string().min(1, "Data subjects description is required"),
  processingPurpose: z.string().min(1, "Processing purpose is required"),
  dataRecipient: z.string().min(1, "Data recipient is required"),
  retentionPeriod: z.string().min(1, "Retention period is required"),
  securityMeasures: z.string().optional(),
  mechanismReference: z.string().optional(),
  contractualSafeguards: z.string().optional(),
  onwardTransferRestrictions: z.string().optional(),
  dataSubjectRights: z.string().optional(),
  reviewDue: z.string().optional(),
  notes: z.string().optional()
});

const tiaFormSchema = z.object({
  tiaReference: z.string().min(1, "TIA reference is required"),
  transferDescription: z.string().min(10, "Transfer description is required"),
  destinationCountry: z.string().min(2, "Destination country is required"),
  legalBasisAssessment: z.string().min(10, "Legal basis assessment is required"),
  riskMitigationMeasures: z.string().min(10, "Risk mitigation measures are required"),
  dataCategoriesAssessed: z.array(z.string()).min(1, "At least one data category must be assessed"),
  dataVolumeAssessment: z.string().min(1, "Data volume assessment is required"),
  frequencyAssessment: z.string().min(1, "Frequency assessment is required"),
  safeguardsAssessment: z.string().min(10, "Safeguards assessment is required"),
  alternativesConsidered: z.string().optional(),
  conclusionAndRecommendation: z.string().min(10, "Conclusion and recommendation are required"),
  nextReviewDate: z.string().optional(),
  notes: z.string().optional()
});

export default function InternationalTransfers() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isGdprEnabled = useIsGdprEnabled();
  
  const [activeTab, setActiveTab] = useState("transfers");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [showCreateTransferDialog, setShowCreateTransferDialog] = useState(false);
  const [showCreateTiaDialog, setShowCreateTiaDialog] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<InternationalTransfer | null>(null);
  const [selectedTia, setSelectedTia] = useState<TransferImpactAssessment | null>(null);

  // Redirect if GDPR is not enabled
  useEffect(() => {
    if (!isGdprEnabled) {
      toast({
        title: "Access Denied",
        description: "International Transfers management is not available in your current plan.",
        variant: "destructive",
      });
    }
  }, [isGdprEnabled, toast]);

  // Check user permissions
  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You need administrator privileges to access International Transfers management.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!isGdprEnabled) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <Globe className="h-12 w-12 mx-auto text-gray-500 mb-4" />
            <CardTitle>International Transfers Not Available</CardTitle>
            <CardDescription>
              International Transfers management requires GDPR features to be enabled.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Fetch international transfers analytics
  const { data: analytics } = useQuery<any>({
    queryKey: ['/api/gdpr/international-transfers/analytics'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch international transfers
  const { data: transfers = [], isLoading: transfersLoading } = useQuery<InternationalTransfer[]>({
    queryKey: ['/api/gdpr/international-transfers'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Fetch Transfer Impact Assessments
  const { data: tias = [], isLoading: tiasLoading } = useQuery<TransferImpactAssessment[]>({
    queryKey: ['/api/gdpr/transfer-impact-assessments'],
    refetchInterval: 10000,
  });

  // Fetch adequacy decisions
  const { data: adequacyDecisions = [] } = useQuery<AdequacyDecision[]>({
    queryKey: ['/api/gdpr/adequacy-decisions'],
  });

  // Fetch overdue transfer reviews
  const { data: overdueTransfers = [] } = useQuery<InternationalTransfer[]>({
    queryKey: ['/api/gdpr/international-transfers/reviews/overdue'],
    refetchInterval: 60000, // Refresh every minute
  });

  // Fetch overdue TIA reviews
  const { data: overdueTias = [] } = useQuery<TransferImpactAssessment[]>({
    queryKey: ['/api/gdpr/transfer-impact-assessments/reviews/overdue'],
    refetchInterval: 60000,
  });

  // Create transfer mutation
  const createTransferMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/gdpr/international-transfers', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/international-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/international-transfers/analytics'] });
      setShowCreateTransferDialog(false);
      toast({
        title: "Transfer Created",
        description: "International transfer has been successfully created.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create international transfer.",
        variant: "destructive",
      });
    },
  });

  // Create TIA mutation
  const createTiaMutation = useMutation({
    mutationFn: (data: any) => apiRequest('/api/gdpr/transfer-impact-assessments', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/transfer-impact-assessments'] });
      setShowCreateTiaDialog(false);
      toast({
        title: "TIA Created",
        description: "Transfer Impact Assessment has been successfully created.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create Transfer Impact Assessment.",
        variant: "destructive",
      });
    },
  });

  // Delete transfer mutation
  const deleteTransferMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/gdpr/international-transfers/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/international-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/international-transfers/analytics'] });
      toast({
        title: "Transfer Deleted",
        description: "International transfer has been successfully deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete international transfer.",
        variant: "destructive",
      });
    },
  });

  // Transfer form
  const transferForm = useForm({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      transferName: "",
      destinationCountry: "",
      legalBasis: "",
      transferMechanism: "",
      description: "",
      dataCategories: [] as string[],
      dataSubjects: "",
      processingPurpose: "",
      dataRecipient: "",
      retentionPeriod: "",
      securityMeasures: "",
      mechanismReference: "",
      contractualSafeguards: "",
      onwardTransferRestrictions: "",
      dataSubjectRights: "",
      reviewDue: "",
      notes: ""
    },
  });

  // TIA form
  const tiaForm = useForm({
    resolver: zodResolver(tiaFormSchema),
    defaultValues: {
      tiaReference: "",
      transferDescription: "",
      destinationCountry: "",
      legalBasisAssessment: "",
      riskMitigationMeasures: "",
      dataCategoriesAssessed: [] as string[],
      dataVolumeAssessment: "",
      frequencyAssessment: "",
      safeguardsAssessment: "",
      alternativesConsidered: "",
      conclusionAndRecommendation: "",
      nextReviewDate: "",
      notes: ""
    },
  });

  // Filter transfers based on search and filters
  const filteredTransfers = (transfers as InternationalTransfer[]).filter((transfer: InternationalTransfer) => {
    const matchesSearch = transfer.transferName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transfer.destinationCountry.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transfer.recipient?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || transfer.status === statusFilter;
    const matchesRisk = riskFilter === "all" || transfer.riskLevel === riskFilter;
    const matchesCountry = countryFilter === "all" || transfer.destinationCountry === countryFilter;
    
    return matchesSearch && matchesStatus && matchesRisk && matchesCountry;
  });

  // Filter TIAs based on search
  const filteredTias = (tias as TransferImpactAssessment[]).filter((tia: TransferImpactAssessment) => {
    return tia.tiaReference.toLowerCase().includes(searchTerm.toLowerCase()) ||
           tia.destinationCountry.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Handle transfer form submission
  const handleCreateTransfer = (data: any) => {
    createTransferMutation.mutate(data);
  };

  // Handle TIA form submission
  const handleCreateTia = (data: any) => {
    createTiaMutation.mutate(data);
  };

  // Handle transfer deletion
  const handleDeleteTransfer = (id: string) => {
    if (confirm("Are you sure you want to delete this international transfer? This action cannot be undone.")) {
      deleteTransferMutation.mutate(id);
    }
  };

  // Get unique countries for filter
  const uniqueCountries = Array.from(new Set((transfers as InternationalTransfer[]).map((t: InternationalTransfer) => t.destinationCountry)));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Globe className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                International Transfers
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                GDPR Chapter V compliance management
              </p>
            </div>
          </div>
        </div>

        {/* Compliance Overview Cards */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <Card data-testid="card-total-transfers">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Transfers</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-total-transfers">
                      {(analytics as any).totalTransfers || 0}
                    </p>
                  </div>
                  <Globe className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-pending-tias">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending TIAs</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-pending-tias">
                      {(analytics as any).pendingTias || 0}
                    </p>
                  </div>
                  <FileText className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-overdue-reviews">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Overdue Reviews</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-overdue-reviews">
                      {(analytics as any).overdueReviews || 0}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-red-500" />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-compliance-score">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Compliance Score</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-compliance-score">
                      {(analytics as any).complianceScore || 0}%
                    </p>
                  </div>
                  <Shield className={`h-8 w-8 ${((analytics as any).complianceScore || 0) >= 90 ? 'text-green-500' : ((analytics as any).complianceScore || 0) >= 70 ? 'text-yellow-500' : 'text-red-500'}`} />
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-high-risk-transfers">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">High Risk</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white" data-testid="text-high-risk-transfers">
                      {(analytics as any).transfersByRiskLevel?.find((r: any) => r.riskLevel === 'high')?.count || 0}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Alerts for overdue items */}
        {((overdueTransfers as any[]).length > 0 || (overdueTias as any[]).length > 0) && (
          <div className="space-y-2">
            {(overdueTransfers as any[]).length > 0 && (
              <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <AlertTitle className="text-red-800 dark:text-red-400">Overdue Transfer Reviews</AlertTitle>
                <AlertDescription className="text-red-700 dark:text-red-300">
                  {(overdueTransfers as any[]).length} international transfers have overdue reviews that require immediate attention.
                </AlertDescription>
              </Alert>
            )}
            {(overdueTias as any[]).length > 0 && (
              <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20">
                <FileText className="h-4 w-4 text-orange-600" />
                <AlertTitle className="text-orange-800 dark:text-orange-400">Overdue TIA Reviews</AlertTitle>
                <AlertDescription className="text-orange-700 dark:text-orange-300">
                  {(overdueTias as any[]).length} Transfer Impact Assessments have overdue reviews.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 lg:w-[600px]" data-testid="tabs-list">
            <TabsTrigger value="transfers" data-testid="tab-transfers">
              Active Transfers
            </TabsTrigger>
            <TabsTrigger value="tia" data-testid="tab-tia">
              Impact Assessments
            </TabsTrigger>
            <TabsTrigger value="mechanisms" data-testid="tab-mechanisms">
              Transfer Mechanisms  
            </TabsTrigger>
            <TabsTrigger value="compliance" data-testid="tab-compliance">
              Compliance Dashboard
            </TabsTrigger>
          </TabsList>

          {/* Active Transfers Tab */}
          <TabsContent value="transfers" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      International Data Transfers
                    </CardTitle>
                    <CardDescription>
                      Manage ongoing international data transfers and their compliance status
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={() => setShowCreateTransferDialog(true)}
                    data-testid="button-create-transfer"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New Transfer
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Search and Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="flex-1">
                    <Input
                      placeholder="Search transfers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full"
                      data-testid="input-search-transfers"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="terminated">Terminated</SelectItem>
                      <SelectItem value="under_review">Under Review</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={riskFilter} onValueChange={setRiskFilter}>
                    <SelectTrigger className="w-[180px]" data-testid="select-risk-filter">
                      <SelectValue placeholder="Risk Level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Risk Levels</SelectItem>
                      <SelectItem value="low">Low Risk</SelectItem>
                      <SelectItem value="medium">Medium Risk</SelectItem>
                      <SelectItem value="high">High Risk</SelectItem>
                      <SelectItem value="very_high">Very High Risk</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={countryFilter} onValueChange={setCountryFilter}>
                    <SelectTrigger className="w-[180px]" data-testid="select-country-filter">
                      <SelectValue placeholder="Country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Countries</SelectItem>
                      {uniqueCountries.map((country) => (
                        <SelectItem key={country} value={country}>
                          {country}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Transfers Table */}
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Transfer Name</TableHead>
                        <TableHead>Destination</TableHead>
                        <TableHead>Risk Level</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Legal Basis</TableHead>
                        <TableHead>Review Due</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transfersLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            Loading transfers...
                          </TableCell>
                        </TableRow>
                      ) : filteredTransfers.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            No international transfers found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTransfers.map((transfer: InternationalTransfer) => {
                          const riskInfo = riskLevelInfo[transfer.riskLevel as keyof typeof riskLevelInfo];
                          const statusInfo = transferStatusInfo[transfer.status as keyof typeof transferStatusInfo];
                          const ReviewIcon = riskInfo?.icon || Shield;

                          return (
                            <TableRow key={transfer.id} data-testid={`row-transfer-${transfer.id}`}>
                              <TableCell className="font-medium">
                                {transfer.transferName}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <MapPin className="h-4 w-4 text-gray-500" />
                                  {transfer.destinationCountry}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={riskInfo?.color} data-testid={`badge-risk-${transfer.id}`}>
                                  <ReviewIcon className="h-3 w-3 mr-1" />
                                  {riskInfo?.title}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge className={statusInfo?.color} data-testid={`badge-status-${transfer.id}`}>
                                  {statusInfo?.title}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                                {legalBasisOptions.find(opt => opt.value === transfer.legalBasis)?.label || transfer.legalBasis}
                              </TableCell>
                              <TableCell>
                                {transfer.reviewDue ? (
                                  <span className={`text-sm ${
                                    isAfter(new Date(), new Date(transfer.reviewDue))
                                      ? 'text-red-600 dark:text-red-400 font-medium'
                                      : 'text-gray-600 dark:text-gray-400'
                                  }`}>
                                    {format(new Date(transfer.reviewDue), 'MMM dd, yyyy')}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">Not set</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" data-testid={`menu-transfer-${transfer.id}`}>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setSelectedTransfer(transfer)}>
                                      <Eye className="h-4 w-4 mr-2" />
                                      View Details
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit Transfer
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                      <ClipboardCheck className="h-4 w-4 mr-2" />
                                      Validate Compliance
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                      <Download className="h-4 w-4 mr-2" />
                                      Export Report
                                    </DropdownMenuItem>
                                    <Separator />
                                    <DropdownMenuItem 
                                      onClick={() => handleDeleteTransfer(transfer.id)}
                                      className="text-red-600 dark:text-red-400"
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete Transfer
                                    </DropdownMenuItem>
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
          </TabsContent>

          {/* Transfer Impact Assessments Tab */}
          <TabsContent value="tia" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Transfer Impact Assessments
                    </CardTitle>
                    <CardDescription>
                      Manage Transfer Impact Assessments (TIA) for high-risk international transfers
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={() => setShowCreateTiaDialog(true)}
                    data-testid="button-create-tia"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    New TIA
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* TIA Table */}
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>TIA Reference</TableHead>
                        <TableHead>Destination Country</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assessor</TableHead>
                        <TableHead>Last Reviewed</TableHead>
                        <TableHead>Next Review</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tiasLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            Loading Transfer Impact Assessments...
                          </TableCell>
                        </TableRow>
                      ) : filteredTias.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            No Transfer Impact Assessments found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredTias.map((tia: TransferImpactAssessment) => {
                          const statusInfo = tiaStatusInfo[tia.status as keyof typeof tiaStatusInfo];
                          const StatusIcon = statusInfo?.icon || FileText;

                          return (
                            <TableRow key={tia.id} data-testid={`row-tia-${tia.id}`}>
                              <TableCell className="font-medium">
                                {tia.tiaReference}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Flag className="h-4 w-4 text-gray-500" />
                                  {tia.destinationCountry}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={statusInfo?.color} data-testid={`badge-tia-status-${tia.id}`}>
                                  <StatusIcon className="h-3 w-3 mr-1" />
                                  {statusInfo?.title}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                                {(tia as any).assessorId || 'Not assigned'}
                              </TableCell>
                              <TableCell>
                                {(tia as any).reviewedAt ? (
                                  <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {format(new Date((tia as any).reviewedAt), 'MMM dd, yyyy')}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">Never</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {tia.nextReviewDate ? (
                                  <span className={`text-sm ${
                                    isAfter(new Date(), new Date(tia.nextReviewDate))
                                      ? 'text-red-600 dark:text-red-400 font-medium'
                                      : 'text-gray-600 dark:text-gray-400'
                                  }`}>
                                    {format(new Date(tia.nextReviewDate), 'MMM dd, yyyy')}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">Not set</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" data-testid={`menu-tia-${tia.id}`}>
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => setSelectedTia(tia)}>
                                      <Eye className="h-4 w-4 mr-2" />
                                      View Assessment
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit TIA
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Approve Assessment
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                      <Download className="h-4 w-4 mr-2" />
                                      Export TIA Report
                                    </DropdownMenuItem>
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
          </TabsContent>

          {/* Transfer Mechanisms Tab */}
          <TabsContent value="mechanisms" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Adequacy Decisions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Adequacy Decisions
                  </CardTitle>
                  <CardDescription>
                    Countries with EU Commission adequacy decisions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    {(adequacyDecisions as any[]).length === 0 ? (
                      <p className="text-gray-500 text-center py-8">No adequacy decisions available</p>
                    ) : (
                      <div className="space-y-2">
                        {(adequacyDecisions as any[]).map((decision: AdequacyDecision) => (
                          <div 
                            key={decision.id} 
                            className="flex items-center justify-between p-3 border rounded-lg"
                            data-testid={`adequacy-decision-${decision.countryCode}`}
                          >
                            <div className="flex items-center gap-3">
                              <Flag className="h-4 w-4 text-gray-500" />
                              <div>
                                <p className="font-medium">{decision.countryName}</p>
                                <p className="text-sm text-gray-500">{decision.countryCode}</p>
                              </div>
                            </div>
                            <Badge 
                              className={decision.status === 'adequate' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                              }
                            >
                              {decision.status === 'adequate' ? 'Adequate' : 'Not Adequate'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Transfer Mechanisms */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="h-5 w-5" />
                    Available Transfer Mechanisms
                  </CardTitle>
                  <CardDescription>
                    Approved mechanisms for international data transfers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {transferMechanismOptions.map((mechanism) => (
                      <div 
                        key={mechanism.value} 
                        className="flex items-center justify-between p-3 border rounded-lg"
                        data-testid={`mechanism-${mechanism.value}`}
                      >
                        <div className="flex items-center gap-3">
                          <Gavel className="h-4 w-4 text-blue-500" />
                          <span className="font-medium">{mechanism.label}</span>
                        </div>
                        <Button variant="ghost" size="sm">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Compliance Dashboard Tab */}
          <TabsContent value="compliance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Risk Overview */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Transfer Risk Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(analytics as any)?.transfersByRiskLevel ? (
                    <div className="space-y-4">
                      {(analytics as any).transfersByRiskLevel.map((risk: any) => {
                        const riskInfo = riskLevelInfo[risk.riskLevel as keyof typeof riskLevelInfo];
                        const percentage = (analytics as any).totalTransfers > 0 
                          ? (risk.count / (analytics as any).totalTransfers) * 100 
                          : 0;
                        
                        return (
                          <div key={risk.riskLevel} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{riskInfo?.title}</span>
                              <span className="text-sm text-gray-500">{risk.count} transfers</span>
                            </div>
                            <Progress 
                              value={percentage} 
                              className="h-2"
                              data-testid={`progress-risk-${risk.riskLevel}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No risk data available</p>
                  )}
                </CardContent>
              </Card>

              {/* Country Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Transfers by Country
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(analytics as any)?.transfersByCountry ? (
                    <div className="space-y-3">
                      {(analytics as any).transfersByCountry.slice(0, 5).map((country: any) => (
                        <div 
                          key={country.country} 
                          className="flex items-center justify-between p-2 border rounded"
                          data-testid={`country-stat-${country.country}`}
                        >
                          <div className="flex items-center gap-2">
                            <Flag className="h-4 w-4 text-gray-500" />
                            <span className="font-medium">{country.country}</span>
                          </div>
                          <Badge variant="secondary">{country.count}</Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-8">No country data available</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Create Transfer Dialog */}
        <Dialog open={showCreateTransferDialog} onOpenChange={setShowCreateTransferDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New International Transfer</DialogTitle>
              <DialogDescription>
                Register a new international data transfer for GDPR Chapter V compliance
              </DialogDescription>
            </DialogHeader>
            <Form {...transferForm}>
              <form onSubmit={transferForm.handleSubmit(handleCreateTransfer)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={transferForm.control}
                    name="transferName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transfer Name *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Customer Support Data to US" 
                            {...field} 
                            data-testid="input-transfer-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={transferForm.control}
                    name="destinationCountry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Destination Country *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., United States" 
                            {...field} 
                            data-testid="input-destination-country"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={transferForm.control}
                    name="legalBasis"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Legal Basis *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-legal-basis">
                              <SelectValue placeholder="Select legal basis" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {legalBasisOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                <div>
                                  <div className="font-medium">{option.label}</div>
                                  <div className="text-sm text-gray-500">{option.description}</div>
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
                    control={transferForm.control}
                    name="transferMechanism"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transfer Mechanism *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-transfer-mechanism">
                              <SelectValue placeholder="Select transfer mechanism" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {transferMechanismOptions.map((option) => (
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
                  control={transferForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transfer Description *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe the purpose and nature of this international data transfer..."
                          {...field} 
                          data-testid="textarea-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={transferForm.control}
                    name="dataRecipient"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Recipient *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Example Corp Inc." 
                            {...field} 
                            data-testid="input-data-recipient"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={transferForm.control}
                    name="processingPurpose"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Processing Purpose *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Customer support services" 
                            {...field} 
                            data-testid="input-processing-purpose"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={transferForm.control}
                  name="dataCategories"
                  render={() => (
                    <FormItem>
                      <FormLabel>Data Categories *</FormLabel>
                      <FormDescription>
                        Select all categories of personal data that will be transferred
                      </FormDescription>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                        {dataCategories.map((category) => (
                          <FormField
                            key={category}
                            control={transferForm.control}
                            name="dataCategories"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(category)}
                                    onCheckedChange={(checked) => {
                                      const updatedValue = checked
                                        ? [...(field.value || []), category]
                                        : (field.value || []).filter((value: string) => value !== category);
                                      field.onChange(updatedValue);
                                    }}
                                    data-testid={`checkbox-category-${category.split(' ')[0].toLowerCase()}`}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">
                                  {category}
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={transferForm.control}
                    name="dataSubjects"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Subjects *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Customers, Employees" 
                            {...field} 
                            data-testid="input-data-subjects"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={transferForm.control}
                    name="retentionPeriod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Retention Period *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., 2 years, Until contract end" 
                            {...field} 
                            data-testid="input-retention-period"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={transferForm.control}
                    name="mechanismReference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mechanism Reference</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., SCC-2021-001, BCR Reference" 
                            {...field} 
                            data-testid="input-mechanism-reference"
                          />
                        </FormControl>
                        <FormDescription>
                          Reference to specific SCCs, BCRs, or other safeguard documents
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={transferForm.control}
                    name="reviewDue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Review Due Date</FormLabel>
                        <FormControl>
                          <Input 
                            type="date" 
                            {...field} 
                            data-testid="input-review-due"
                          />
                        </FormControl>
                        <FormDescription>
                          When should this transfer be reviewed next?
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={transferForm.control}
                  name="securityMeasures"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Security Measures</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe technical and organisational security measures in place..."
                          {...field} 
                          data-testid="textarea-security-measures"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowCreateTransferDialog(false)}
                    data-testid="button-cancel-transfer"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createTransferMutation.isPending}
                    data-testid="button-submit-transfer"
                  >
                    {createTransferMutation.isPending ? 'Creating...' : 'Create Transfer'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Create TIA Dialog */}
        <Dialog open={showCreateTiaDialog} onOpenChange={setShowCreateTiaDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Transfer Impact Assessment</DialogTitle>
              <DialogDescription>
                Conduct a comprehensive Transfer Impact Assessment for high-risk international transfers
              </DialogDescription>
            </DialogHeader>
            <Form {...tiaForm}>
              <form onSubmit={tiaForm.handleSubmit(handleCreateTia)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={tiaForm.control}
                    name="tiaReference"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TIA Reference *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., TIA-2024-001" 
                            {...field} 
                            data-testid="input-tia-reference"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={tiaForm.control}
                    name="destinationCountry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Destination Country *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., United States" 
                            {...field} 
                            data-testid="input-tia-destination-country"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={tiaForm.control}
                  name="transferDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transfer Description *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Provide a detailed description of the international transfer being assessed..."
                          {...field} 
                          data-testid="textarea-tia-transfer-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={tiaForm.control}
                  name="legalBasisAssessment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Legal Basis Assessment *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Assess the legal basis for this transfer under UK GDPR..."
                          {...field} 
                          data-testid="textarea-legal-basis-assessment"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={tiaForm.control}
                  name="riskMitigationMeasures"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Risk Mitigation Measures *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Detail the measures in place to mitigate transfer risks..."
                          {...field} 
                          data-testid="textarea-risk-mitigation"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={tiaForm.control}
                  name="dataCategoriesAssessed"
                  render={() => (
                    <FormItem>
                      <FormLabel>Data Categories Assessed *</FormLabel>
                      <FormDescription>
                        Select the categories of personal data covered by this TIA
                      </FormDescription>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto border rounded-md p-3">
                        {dataCategories.map((category) => (
                          <FormField
                            key={category}
                            control={tiaForm.control}
                            name="dataCategoriesAssessed"
                            render={({ field }) => (
                              <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(category)}
                                    onCheckedChange={(checked) => {
                                      const updatedValue = checked
                                        ? [...(field.value || []), category]
                                        : (field.value || []).filter((value: string) => value !== category);
                                      field.onChange(updatedValue);
                                    }}
                                    data-testid={`checkbox-tia-category-${category.split(' ')[0].toLowerCase()}`}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal">
                                  {category}
                                </FormLabel>
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={tiaForm.control}
                    name="dataVolumeAssessment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data Volume Assessment *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., <10,000 records, High volume" 
                            {...field} 
                            data-testid="input-data-volume"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={tiaForm.control}
                    name="frequencyAssessment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Transfer Frequency *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="e.g., Daily, Weekly, One-time" 
                            {...field} 
                            data-testid="input-frequency"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={tiaForm.control}
                  name="safeguardsAssessment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Safeguards Assessment *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Assess the effectiveness of safeguards in place for this transfer..."
                          {...field} 
                          data-testid="textarea-safeguards-assessment"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={tiaForm.control}
                  name="alternativesConsidered"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alternatives Considered</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Document any alternative approaches or destinations considered..."
                          {...field} 
                          data-testid="textarea-alternatives"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={tiaForm.control}
                  name="conclusionAndRecommendation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Conclusion and Recommendation *</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Provide your conclusion and recommendations regarding this transfer..."
                          {...field} 
                          data-testid="textarea-conclusion"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={tiaForm.control}
                  name="nextReviewDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Next Review Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          data-testid="input-tia-next-review"
                        />
                      </FormControl>
                      <FormDescription>
                        When should this TIA be reviewed next?
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowCreateTiaDialog(false)}
                    data-testid="button-cancel-tia"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createTiaMutation.isPending}
                    data-testid="button-submit-tia"
                  >
                    {createTiaMutation.isPending ? 'Creating...' : 'Create TIA'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Transfer Details Dialog */}
        {selectedTransfer && (
          <Dialog open={!!selectedTransfer} onOpenChange={() => setSelectedTransfer(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Transfer Details: {selectedTransfer.transferName}</DialogTitle>
                <DialogDescription>
                  Complete details for this international data transfer
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Basic Information</h4>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm text-gray-500">Destination Country:</span>
                        <p className="font-medium">{selectedTransfer.destinationCountry}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Data Recipient:</span>
                        <p className="font-medium">{selectedTransfer.recipient}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Legal Basis:</span>
                        <p className="font-medium">
                          {legalBasisOptions.find(opt => opt.value === selectedTransfer.legalBasis)?.label || selectedTransfer.legalBasis}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Risk Assessment</h4>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm text-gray-500">Risk Level:</span>
                        <div className="mt-1">
                          <Badge className={riskLevelInfo[selectedTransfer.riskLevel as keyof typeof riskLevelInfo]?.color}>
                            {riskLevelInfo[selectedTransfer.riskLevel as keyof typeof riskLevelInfo]?.title}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Risk Score:</span>
                        <p className="font-medium">{(selectedTransfer as any).riskScore || 'Not assessed'}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Assessment Date:</span>
                        <p className="font-medium">
                          {selectedTransfer.riskAssessmentDate 
                            ? format(new Date(selectedTransfer.riskAssessmentDate), 'MMM dd, yyyy')
                            : 'Not assessed'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Transfer Description</h4>
                  <p className="text-gray-700 dark:text-gray-300">{(selectedTransfer as any).description}</p>
                </div>

                {selectedTransfer.dataCategories && selectedTransfer.dataCategories.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Data Categories</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTransfer.dataCategories.map((category) => (
                        <Badge key={category} variant="secondary">
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {(selectedTransfer as any).riskFactors && (selectedTransfer as any).riskFactors.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Risk Factors</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {(selectedTransfer as any).riskFactors.map((factor: any, index: number) => (
                        <li key={index} className="text-gray-700 dark:text-gray-300">{factor}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {(selectedTransfer as any).securityMeasures && (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Security Measures</h4>
                    <p className="text-gray-700 dark:text-gray-300">{(selectedTransfer as any).securityMeasures}</p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* TIA Details Dialog */}
        {selectedTia && (
          <Dialog open={!!selectedTia} onOpenChange={() => setSelectedTia(null)}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>TIA Details: {selectedTia.tiaReference}</DialogTitle>
                <DialogDescription>
                  Transfer Impact Assessment details and findings
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Assessment Information</h4>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm text-gray-500">Status:</span>
                        <div className="mt-1">
                          <Badge className={tiaStatusInfo[selectedTia.status as keyof typeof tiaStatusInfo]?.color}>
                            {tiaStatusInfo[selectedTia.status as keyof typeof tiaStatusInfo]?.title}
                          </Badge>
                        </div>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Destination Country:</span>
                        <p className="font-medium">{selectedTia.destinationCountry}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Data Volume:</span>
                        <p className="font-medium">{(selectedTia as any).dataVolumeAssessment}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Review Information</h4>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm text-gray-500">Last Reviewed:</span>
                        <p className="font-medium">
                          {(selectedTia as any).reviewedAt 
                            ? format(new Date((selectedTia as any).reviewedAt), 'MMM dd, yyyy')
                            : 'Never'
                          }
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Next Review:</span>
                        <p className="font-medium">
                          {selectedTia.nextReviewDate 
                            ? format(new Date(selectedTia.nextReviewDate), 'MMM dd, yyyy')
                            : 'Not scheduled'
                          }
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-500">Transfer Frequency:</span>
                        <p className="font-medium">{(selectedTia as any).frequencyAssessment}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Transfer Description</h4>
                  <p className="text-gray-700 dark:text-gray-300">{(selectedTia as any).transferDescription}</p>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Legal Basis Assessment</h4>
                  <p className="text-gray-700 dark:text-gray-300">{selectedTia.lawfulBasisAssessment}</p>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Risk Mitigation Measures</h4>
                  <p className="text-gray-700 dark:text-gray-300">{(selectedTia as any).riskMitigationMeasures}</p>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Safeguards Assessment</h4>
                  <p className="text-gray-700 dark:text-gray-300">{(selectedTia as any).safeguardsAssessment}</p>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">Conclusion and Recommendation</h4>
                  <p className="text-gray-700 dark:text-gray-300">{(selectedTia as any).conclusionAndRecommendation}</p>
                </div>

                {(selectedTia as any).dataCategoriesAssessed && (selectedTia as any).dataCategoriesAssessed.length > 0 && (
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Data Categories Assessed</h4>
                    <div className="flex flex-wrap gap-2">
                      {(selectedTia as any).dataCategoriesAssessed.map((category: any) => (
                        <Badge key={category} variant="secondary">
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}