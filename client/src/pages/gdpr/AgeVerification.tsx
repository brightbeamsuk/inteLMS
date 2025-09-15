import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsGdprEnabled } from "@/hooks/useGdpr";
import { Link } from "wouter";
import { format } from "date-fns";
import { 
  Shield, 
  Users, 
  UserCheck,
  Baby,
  Heart,
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Activity,
  Eye,
  Edit,
  Trash2,
  Download,
  Settings,
  Search,
  Filter,
  Plus,
  Mail,
  Phone,
  Calendar,
  FileText,
  Video,
  CreditCard,
  Upload,
  RefreshCw,
  MoreHorizontal,
  User,
  Lock,
  Unlock,
  AlertCircle,
  Info
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell
} from 'recharts';
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Types for age verification system
interface AgeVerification {
  id: string;
  userId: string;
  organisationId: string;
  dateOfBirth: string;
  ageGroup: 'child_under_13' | 'child_13_to_16' | 'adult_over_16';
  verificationMethod: 'self_declaration' | 'document_verification' | 'credit_check' | 'parental_verification';
  verificationStatus: 'pending' | 'verified' | 'failed' | 'pending_parental_consent';
  parentalConsentRequired: boolean;
  evidenceType?: string;
  evidenceData?: Record<string, any>;
  verifiedAt?: string;
  verifiedBy?: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

interface ParentalConsent {
  id: string;
  childUserId: string;
  organisationId: string;
  parentEmail: string;
  parentName: string;
  parentPhoneNumber?: string;
  relationshipToChild: 'parent' | 'guardian' | 'legal_representative';
  consentStatus: 'pending' | 'granted' | 'withdrawn' | 'expired';
  consentMechanism: 'email_verification' | 'video_call' | 'document_verification' | 'payment_card_verification';
  consentTypes: string[];
  consentGrantedAt?: string;
  consentExpiryDate?: string;
  lastRenewalDate?: string;
  verificationEvidence?: Record<string, any>;
  verificationMethod?: string;
  verificationNotes?: string;
  withdrawalReason?: string;
  withdrawnAt?: string;
  createdAt: string;
  updatedAt: string;
  child?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

interface ConsentMetrics {
  totalChildAccounts: number;
  activeConsents: number;
  pendingConsents: number;
  expiringSoon: number;
  withdrawnConsents: number;
  verificationMethods: Record<string, number>;
}

// Age group colors and info
const ageGroupInfo = {
  child_under_13: {
    title: "Under 13",
    icon: Baby,
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    description: "Requires parental consent under UK GDPR Article 8"
  },
  child_13_to_16: {
    title: "13-16 Years",
    icon: User,
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    description: "Transitional age group with enhanced protections"
  },
  adult_over_16: {
    title: "Over 16",
    icon: UserCheck,
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    description: "Full capacity to provide consent"
  }
};

const verificationStatusColors = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  verified: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  pending_parental_consent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
};

const consentStatusColors = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  granted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  withdrawn: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  expired: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
};

const verificationMethodIcons = {
  email_verification: Mail,
  video_call: Video,
  document_verification: FileText,
  payment_card_verification: CreditCard
};

export function AgeVerification() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isGdprEnabled = useIsGdprEnabled();
  
  // State management
  const [selectedTab, setSelectedTab] = useState("overview");
  const [ageGroupFilter, setAgeGroupFilter] = useState<string>("");
  const [verificationStatusFilter, setVerificationStatusFilter] = useState<string>("");
  const [consentStatusFilter, setConsentStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal states
  const [isCreateVerificationOpen, setIsCreateVerificationOpen] = useState(false);
  const [isCreateConsentOpen, setIsCreateConsentOpen] = useState(false);
  const [isVerificationDetailOpen, setIsVerificationDetailOpen] = useState(false);
  const [isConsentDetailOpen, setIsConsentDetailOpen] = useState(false);
  const [selectedVerification, setSelectedVerification] = useState<AgeVerification | null>(null);
  const [selectedConsent, setSelectedConsent] = useState<ParentalConsent | null>(null);
  
  // Form states
  const [verificationForm, setVerificationForm] = useState({
    userId: "",
    dateOfBirth: "",
    verificationMethod: "self_declaration" as const,
    evidenceType: "",
    evidenceData: {}
  });
  
  const [consentForm, setConsentForm] = useState({
    childUserId: "",
    parentEmail: "",
    parentName: "",
    parentPhoneNumber: "",
    relationshipToChild: "parent" as const,
    consentMechanism: "email_verification" as const,
    consentTypes: ["data_processing", "account_creation"]
  });

  // Check GDPR enablement
  if (!isGdprEnabled) {
    return (
      <div className="container mx-auto p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>GDPR Features Disabled</AlertTitle>
          <AlertDescription>
            GDPR compliance features are not enabled for this organization.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Fetch age verifications
  const { data: verifications = [], isLoading: verificationLoading } = useQuery<AgeVerification[]>({
    queryKey: ['/api/gdpr/age-verifications'],
    enabled: !!user && (user.role === 'admin' || user.role === 'superadmin')
  });

  // Fetch parental consents
  const { data: consents = [], isLoading: consentLoading } = useQuery<ParentalConsent[]>({
    queryKey: ['/api/gdpr/parental-consents'],
    enabled: !!user && (user.role === 'admin' || user.role === 'superadmin')
  });

  // Fetch consent metrics
  const { data: metrics } = useQuery<ConsentMetrics>({
    queryKey: ['/api/gdpr/parental-consent/metrics'],
    enabled: !!user && (user.role === 'admin' || user.role === 'superadmin')
  });

  // Create age verification mutation
  const createVerificationMutation = useMutation({
    mutationFn: (data: typeof verificationForm) => 
      apiRequest('POST', '/api/gdpr/age-verification', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/age-verifications'] });
      setIsCreateVerificationOpen(false);
      setVerificationForm({
        userId: "",
        dateOfBirth: "",
        verificationMethod: "self_declaration",
        evidenceType: "",
        evidenceData: {}
      });
      toast({
        title: "Age verification created",
        description: "The age verification has been successfully created."
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create age verification."
      });
    }
  });

  // Create parental consent mutation
  const createConsentMutation = useMutation({
    mutationFn: (data: typeof consentForm) => 
      apiRequest('POST', '/api/gdpr/parental-consent', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/parental-consents'] });
      setIsCreateConsentOpen(false);
      setConsentForm({
        childUserId: "",
        parentEmail: "",
        parentName: "",
        parentPhoneNumber: "",
        relationshipToChild: "parent",
        consentMechanism: "email_verification",
        consentTypes: ["data_processing", "account_creation"]
      });
      toast({
        title: "Parental consent request created",
        description: "The parental consent request has been successfully created."
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to create parental consent request."
      });
    }
  });

  // Initiate verification mutation
  const initiateVerificationMutation = useMutation({
    mutationFn: ({ consentId, verificationMethod }: { consentId: string; verificationMethod: string }) => 
      apiRequest('POST', `/api/gdpr/parental-consent/${consentId}/verify`, { verificationMethod }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/parental-consents'] });
      toast({
        title: "Verification initiated",
        description: "Parental consent verification has been initiated."
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to initiate verification."
      });
    }
  });

  // Filter data
  const filteredVerifications = verifications.filter((verification: AgeVerification) => {
    const matchesAgeGroup = !ageGroupFilter || verification.ageGroup === ageGroupFilter;
    const matchesStatus = !verificationStatusFilter || verification.verificationStatus === verificationStatusFilter;
    const matchesSearch = !searchQuery || 
      verification.user?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      verification.user?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      verification.user?.lastName?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesAgeGroup && matchesStatus && matchesSearch;
  });

  const filteredConsents = consents.filter((consent: ParentalConsent) => {
    const matchesStatus = !consentStatusFilter || consent.consentStatus === consentStatusFilter;
    const matchesSearch = !searchQuery || 
      consent.parentEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      consent.parentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      consent.child?.email?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Chart data
  const ageGroupData = metrics ? [
    { name: "Under 13", value: filteredVerifications.filter(v => v.ageGroup === 'child_under_13').length, color: '#ef4444' },
    { name: "13-16 Years", value: filteredVerifications.filter(v => v.ageGroup === 'child_13_to_16').length, color: '#f59e0b' },
    { name: "Over 16", value: filteredVerifications.filter(v => v.ageGroup === 'adult_over_16').length, color: '#10b981' }
  ] : [];

  const consentStatusData = metrics ? [
    { name: "Active", value: metrics.activeConsents, color: '#10b981' },
    { name: "Pending", value: metrics.pendingConsents, color: '#f59e0b' },
    { name: "Expiring Soon", value: metrics.expiringSoon, color: '#f97316' },
    { name: "Withdrawn", value: metrics.withdrawnConsents, color: '#ef4444' }
  ] : [];

  return (
    <div className="container mx-auto p-6" data-testid="page-age-verification">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="title-age-verification">Age Verification & Parental Consent</h1>
          <p className="text-muted-foreground mt-2">
            UK GDPR Article 8 compliance management for child data protection
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsCreateVerificationOpen(true)}
            data-testid="button-create-verification"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Verification
          </Button>
          <Button
            onClick={() => setIsCreateConsentOpen(true)}
            variant="outline"
            data-testid="button-create-consent"
          >
            <Heart className="h-4 w-4 mr-2" />
            Request Parental Consent
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card data-testid="card-total-children">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Child Accounts</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-children">{metrics.totalChildAccounts}</div>
              <p className="text-xs text-muted-foreground">
                Accounts requiring enhanced protection
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-active-consents">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Consents</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600" data-testid="text-active-consents">{metrics.activeConsents}</div>
              <p className="text-xs text-muted-foreground">
                Valid parental consent records
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-pending-consents">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Verification</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600" data-testid="text-pending-consents">{metrics.pendingConsents}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting parental verification
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-expiring-soon">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600" data-testid="text-expiring-soon">{metrics.expiringSoon}</div>
              <p className="text-xs text-muted-foreground">
                Requiring renewal within 30 days
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="verifications" data-testid="tab-verifications">Age Verifications</TabsTrigger>
          <TabsTrigger value="consents" data-testid="tab-consents">Parental Consents</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Age Group Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Age Group Distribution</CardTitle>
                <CardDescription>
                  Distribution of users by age category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={ageGroupData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {ageGroupData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Consent Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Consent Status Overview</CardTitle>
                <CardDescription>
                  Current status of parental consent records
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={consentStatusData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#8884d8" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest age verification and parental consent activities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredVerifications.slice(0, 5).map((verification) => {
                  const IconComponent = ageGroupInfo[verification.ageGroup]?.icon;
                  return (
                  <div key={verification.id} className="flex items-center space-x-4 p-3 border rounded-lg">
                    <div className="flex-shrink-0">
                      {IconComponent && 
                        <IconComponent className="h-5 w-5 text-muted-foreground" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Age verification for {verification.user?.email}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(verification.createdAt), 'MMM d, yyyy HH:mm')}
                      </p>
                    </div>
                    <Badge className={verificationStatusColors[verification.verificationStatus]}>
                      {verification.verificationStatus.replace('_', ' ')}
                    </Badge>
                  </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="verifications" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Age Verifications</CardTitle>
              <CardDescription>
                Manage age verification records for all users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                    data-testid="input-search-verifications"
                  />
                </div>
                <Select value={ageGroupFilter} onValueChange={setAgeGroupFilter}>
                  <SelectTrigger className="w-[200px]" data-testid="select-age-group-filter">
                    <SelectValue placeholder="Filter by age group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All age groups</SelectItem>
                    <SelectItem value="child_under_13">Under 13</SelectItem>
                    <SelectItem value="child_13_to_16">13-16 Years</SelectItem>
                    <SelectItem value="adult_over_16">Over 16</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={verificationStatusFilter} onValueChange={setVerificationStatusFilter}>
                  <SelectTrigger className="w-[200px]" data-testid="select-verification-status-filter">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                    <SelectItem value="pending_parental_consent">Pending Parental Consent</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Verifications Table */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Age Group</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {verificationLoading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8">
                          <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
                          Loading verifications...
                        </TableCell>
                      </TableRow>
                    ) : filteredVerifications.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No age verifications found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredVerifications.map((verification) => (
                        <TableRow key={verification.id} data-testid={`row-verification-${verification.id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {verification.user?.firstName} {verification.user?.lastName}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {verification.user?.email}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={ageGroupInfo[verification.ageGroup].color}>
                              {ageGroupInfo[verification.ageGroup].title}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">
                            {verification.verificationMethod.replace('_', ' ')}
                          </TableCell>
                          <TableCell>
                            <Badge className={verificationStatusColors[verification.verificationStatus]}>
                              {verification.verificationStatus.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {format(new Date(verification.createdAt), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  className="h-8 w-8 p-0"
                                  data-testid={`button-actions-verification-${verification.id}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedVerification(verification);
                                    setIsVerificationDetailOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consents" className="space-y-4">
          {/* Parental Consents */}
          <Card>
            <CardHeader>
              <CardTitle>Parental Consent Records</CardTitle>
              <CardDescription>
                Manage parental consent verification and compliance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search by parent or child..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full"
                    data-testid="input-search-consents"
                  />
                </div>
                <Select value={consentStatusFilter} onValueChange={setConsentStatusFilter}>
                  <SelectTrigger className="w-[200px]" data-testid="select-consent-status-filter">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="granted">Granted</SelectItem>
                    <SelectItem value="withdrawn">Withdrawn</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Consents Table */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Child</TableHead>
                      <TableHead>Parent/Guardian</TableHead>
                      <TableHead>Relationship</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {consentLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8">
                          <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
                          Loading consents...
                        </TableCell>
                      </TableRow>
                    ) : filteredConsents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No parental consent records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredConsents.map((consent) => (
                        <TableRow key={consent.id} data-testid={`row-consent-${consent.id}`}>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {consent.child?.firstName} {consent.child?.lastName}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {consent.child?.email}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{consent.parentName}</p>
                              <p className="text-sm text-muted-foreground">{consent.parentEmail}</p>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">
                            {consent.relationshipToChild.replace('_', ' ')}
                          </TableCell>
                          <TableCell>
                            <Badge className={consentStatusColors[consent.consentStatus]}>
                              {consent.consentStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize">
                            <div className="flex items-center">
                              {(() => {
                                const IconComponent = verificationMethodIcons[consent.consentMechanism];
                                return IconComponent && <IconComponent className="h-4 w-4 mr-2" />;
                              })()}
                              {consent.consentMechanism.replace('_', ' ')}
                            </div>
                          </TableCell>
                          <TableCell>
                            {format(new Date(consent.createdAt), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button 
                                  variant="ghost" 
                                  className="h-8 w-8 p-0"
                                  data-testid={`button-actions-consent-${consent.id}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem 
                                  onClick={() => {
                                    setSelectedConsent(consent);
                                    setIsConsentDetailOpen(true);
                                  }}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </DropdownMenuItem>
                                {consent.consentStatus === 'pending' && (
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      initiateVerificationMutation.mutate({
                                        consentId: consent.id,
                                        verificationMethod: consent.consentMechanism
                                      });
                                    }}
                                  >
                                    <Activity className="h-4 w-4 mr-2" />
                                    Initiate Verification
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {/* Analytics content will be implemented in future tasks */}
          <Card>
            <CardHeader>
              <CardTitle>Compliance Analytics</CardTitle>
              <CardDescription>
                Advanced analytics and reporting for child data protection compliance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <BarChart className="h-12 w-12 mx-auto mb-4" />
                <p>Advanced analytics coming soon</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Verification Dialog */}
      <Dialog open={isCreateVerificationOpen} onOpenChange={setIsCreateVerificationOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create Age Verification</DialogTitle>
            <DialogDescription>
              Create a new age verification record for a user
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">User ID</label>
              <Input
                value={verificationForm.userId}
                onChange={(e) => setVerificationForm(prev => ({ ...prev, userId: e.target.value }))}
                placeholder="Enter user ID"
                data-testid="input-verification-user-id"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Date of Birth</label>
              <Input
                type="date"
                value={verificationForm.dateOfBirth}
                onChange={(e) => setVerificationForm(prev => ({ ...prev, dateOfBirth: e.target.value }))}
                data-testid="input-verification-dob"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Verification Method</label>
              <Select 
                value={verificationForm.verificationMethod} 
                onValueChange={(value: any) => setVerificationForm(prev => ({ ...prev, verificationMethod: value }))}
              >
                <SelectTrigger data-testid="select-verification-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self_declaration">Self Declaration</SelectItem>
                  <SelectItem value="document_verification">Document Verification</SelectItem>
                  <SelectItem value="credit_check">Credit Check</SelectItem>
                  <SelectItem value="parental_verification">Parental Verification</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsCreateVerificationOpen(false)}
              data-testid="button-cancel-verification"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => createVerificationMutation.mutate(verificationForm)}
              disabled={createVerificationMutation.isPending}
              data-testid="button-create-verification-submit"
            >
              {createVerificationMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Create Verification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Consent Dialog */}
      <Dialog open={isCreateConsentOpen} onOpenChange={setIsCreateConsentOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Request Parental Consent</DialogTitle>
            <DialogDescription>
              Create a new parental consent request for a child user
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Child User ID</label>
              <Input
                value={consentForm.childUserId}
                onChange={(e) => setConsentForm(prev => ({ ...prev, childUserId: e.target.value }))}
                placeholder="Enter child user ID"
                data-testid="input-consent-child-id"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Parent Name</label>
                <Input
                  value={consentForm.parentName}
                  onChange={(e) => setConsentForm(prev => ({ ...prev, parentName: e.target.value }))}
                  placeholder="Enter parent name"
                  data-testid="input-consent-parent-name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Parent Email</label>
                <Input
                  type="email"
                  value={consentForm.parentEmail}
                  onChange={(e) => setConsentForm(prev => ({ ...prev, parentEmail: e.target.value }))}
                  placeholder="Enter parent email"
                  data-testid="input-consent-parent-email"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Relationship</label>
                <Select 
                  value={consentForm.relationshipToChild} 
                  onValueChange={(value: any) => setConsentForm(prev => ({ ...prev, relationshipToChild: value }))}
                >
                  <SelectTrigger data-testid="select-consent-relationship">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="parent">Parent</SelectItem>
                    <SelectItem value="guardian">Guardian</SelectItem>
                    <SelectItem value="legal_representative">Legal Representative</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Verification Method</label>
                <Select 
                  value={consentForm.consentMechanism} 
                  onValueChange={(value: any) => setConsentForm(prev => ({ ...prev, consentMechanism: value }))}
                >
                  <SelectTrigger data-testid="select-consent-mechanism">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email_verification">Email Verification</SelectItem>
                    <SelectItem value="video_call">Video Call</SelectItem>
                    <SelectItem value="document_verification">Document Verification</SelectItem>
                    <SelectItem value="payment_card_verification">Payment Card Verification</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsCreateConsentOpen(false)}
              data-testid="button-cancel-consent"
            >
              Cancel
            </Button>
            <Button 
              onClick={() => createConsentMutation.mutate(consentForm)}
              disabled={createConsentMutation.isPending}
              data-testid="button-create-consent-submit"
            >
              {createConsentMutation.isPending && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Create Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verification Detail Dialog */}
      {selectedVerification && (
        <Dialog open={isVerificationDetailOpen} onOpenChange={setIsVerificationDetailOpen}>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>Age Verification Details</DialogTitle>
              <DialogDescription>
                Detailed information about this age verification record
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">User</label>
                  <p className="text-sm">
                    {selectedVerification.user?.firstName} {selectedVerification.user?.lastName}
                    <br />
                    <span className="text-muted-foreground">{selectedVerification.user?.email}</span>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Age Group</label>
                  <div className="mt-1">
                    <Badge className={ageGroupInfo[selectedVerification.ageGroup].color}>
                      {ageGroupInfo[selectedVerification.ageGroup].title}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Verification Method</label>
                  <p className="text-sm capitalize">{selectedVerification.verificationMethod.replace('_', ' ')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">
                    <Badge className={verificationStatusColors[selectedVerification.verificationStatus]}>
                      {selectedVerification.verificationStatus.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <p className="text-sm">{format(new Date(selectedVerification.createdAt), 'PPP pp')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Parental Consent Required</label>
                  <p className="text-sm">{selectedVerification.parentalConsentRequired ? 'Yes' : 'No'}</p>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsVerificationDetailOpen(false)}
                data-testid="button-close-verification-detail"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Consent Detail Dialog */}
      {selectedConsent && (
        <Dialog open={isConsentDetailOpen} onOpenChange={setIsConsentDetailOpen}>
          <DialogContent className="sm:max-w-[700px]">
            <DialogHeader>
              <DialogTitle>Parental Consent Details</DialogTitle>
              <DialogDescription>
                Detailed information about this parental consent record
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Child</label>
                  <p className="text-sm">
                    {selectedConsent.child?.firstName} {selectedConsent.child?.lastName}
                    <br />
                    <span className="text-muted-foreground">{selectedConsent.child?.email}</span>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Parent/Guardian</label>
                  <p className="text-sm">
                    {selectedConsent.parentName}
                    <br />
                    <span className="text-muted-foreground">{selectedConsent.parentEmail}</span>
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Relationship</label>
                  <p className="text-sm capitalize">{selectedConsent.relationshipToChild.replace('_', ' ')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">
                    <Badge className={consentStatusColors[selectedConsent.consentStatus]}>
                      {selectedConsent.consentStatus}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Verification Method</label>
                  <div className="flex items-center mt-1">
                    {(() => {
                      const IconComponent = verificationMethodIcons[selectedConsent.consentMechanism];
                      return IconComponent && <IconComponent className="h-4 w-4 mr-2" />;
                    })()}
                    <span className="text-sm capitalize">{selectedConsent.consentMechanism.replace('_', ' ')}</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Created</label>
                  <p className="text-sm">{format(new Date(selectedConsent.createdAt), 'PPP pp')}</p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Consent Types</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {selectedConsent.consentTypes.map((type, index) => (
                    <Badge key={index} variant="outline">{type.replace('_', ' ')}</Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => setIsConsentDetailOpen(false)}
                data-testid="button-close-consent-detail"
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}