import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, FileText, Download, Eye, Edit, Send, History, Shield, CheckCircle, AlertCircle, Clock, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";

// Types for compliance documents
interface ComplianceDocument {
  id: string;
  organisationId: string;
  documentType: string;
  title: string;
  description?: string;
  documentReference?: string;
  content: string;
  htmlContent?: string;
  plainTextContent?: string;
  wordCount?: number;
  readingTime?: number;
  templateId?: string;
  templateVersion?: string;
  status: 'draft' | 'review' | 'approved' | 'published' | 'archived';
  version: string;
  generatedBy?: string;
  generatedAt?: Date;
  lastModifiedBy?: string;
  lastModifiedAt?: Date;
  complianceStatus: 'compliant' | 'pending_review' | 'non_compliant' | 'outdated';
  regulatoryRequirements?: string[];
  applicableLaws?: string[];
  isActive: boolean;
  allowsPublicAccess: boolean;
  publishedBy?: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ComplianceDocumentTemplate {
  id: string;
  name: string;
  description?: string;
  documentType: string;
  templateKey: string;
  content: string;
  htmlContent?: string;
  variables?: string[];
  requiredData?: string[];
  regulatoryCompliance?: string[];
  applicableJurisdictions?: string[];
  isDefault: boolean;
  isActive: boolean;
  allowCustomization: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface DocumentAuditEntry {
  id: string;
  organisationId: string;
  documentId: string;
  action: string;
  actionBy: string;
  actionDetails?: string;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

interface GeneratedDocumentContent {
  title: string;
  content: string;
  htmlContent: string;
  plainTextContent: string;
  wordCount: number;
  readingTime: number;
  regulatoryRequirements: string[];
  applicableLaws: string[];
}

// Document type options
const DOCUMENT_TYPES = [
  { value: 'privacy_policy', label: 'Privacy Policy', description: 'UK GDPR compliant privacy notice' },
  { value: 'cookie_policy', label: 'Cookie Policy', description: 'PECR compliant cookie information' },
  { value: 'data_protection_agreement', label: 'Data Protection Agreement', description: 'Article 28 DPA for processors' },
  { value: 'terms_of_service', label: 'Terms of Service', description: 'Platform terms and conditions' },
  { value: 'children_privacy_notice', label: 'Children\'s Privacy Notice', description: 'Privacy notice for under-18s' },
  { value: 'user_rights_information', label: 'User Rights Information', description: 'GDPR rights explanatory document' }
];

// Helper functions
const getStatusColor = (status: string) => {
  switch (status) {
    case 'published': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'approved': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
    case 'review': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'draft': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    case 'archived': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
};

const getComplianceStatusColor = (status: string) => {
  switch (status) {
    case 'compliant': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'pending_review': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'non_compliant': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    case 'outdated': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
  }
};

const formatDate = (date: Date | string) => {
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

export default function ComplianceDocuments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // State management
  const [activeTab, setActiveTab] = useState("documents");
  const [selectedDocument, setSelectedDocument] = useState<ComplianceDocument | null>(null);
  const [previewDocument, setPreviewDocument] = useState<GeneratedDocumentContent | null>(null);
  const [isGenerateDialogOpen, setIsGenerateDialogOpen] = useState(false);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    documentType: '',
    templateId: '',
    title: '',
    description: ''
  });
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    content: ''
  });
  const [publishForm, setPublishForm] = useState({
    isPublic: true,
    publicUrl: '',
    passwordProtected: false,
    accessPassword: '',
    publicationNotes: ''
  });

  // Fetch compliance documents
  const { data: documents = [], isLoading: documentsLoading } = useQuery({
    queryKey: ['/api/gdpr/compliance-documents'],
    enabled: true
  });

  // Fetch document templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/gdpr/compliance-document-templates'],
    enabled: true
  });

  // Fetch audit trail for selected document
  const { data: auditTrail = [], isLoading: auditLoading } = useQuery({
    queryKey: ['/api/gdpr/compliance-documents', selectedDocument?.id, 'audit'],
    enabled: !!selectedDocument?.id
  });

  // Generate document mutation
  const generateDocumentMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/gdpr/compliance-documents/generate', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      toast({
        title: "Document Generated",
        description: "The compliance document has been generated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/compliance-documents'] });
      setIsGenerateDialogOpen(false);
      setGenerateForm({ documentType: '', templateId: '', title: '', description: '' });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate document",
        variant: "destructive"
      });
    }
  });

  // Preview document mutation
  const previewDocumentMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('/api/gdpr/compliance-documents/preview', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: (data: GeneratedDocumentContent) => {
      setPreviewDocument(data);
      setIsPreviewDialogOpen(true);
    },
    onError: (error: any) => {
      toast({
        title: "Preview Failed",
        description: error.message || "Failed to preview document",
        variant: "destructive"
      });
    }
  });

  // Update document mutation
  const updateDocumentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest(`/api/gdpr/compliance-documents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      toast({
        title: "Document Updated",
        description: "The document has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/compliance-documents'] });
      setIsEditDialogOpen(false);
      setSelectedDocument(null);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update document",
        variant: "destructive"
      });
    }
  });

  // Publish document mutation
  const publishDocumentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return await apiRequest(`/api/gdpr/compliance-documents/${id}/publish`, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: { 'Content-Type': 'application/json' }
      });
    },
    onSuccess: () => {
      toast({
        title: "Document Published",
        description: "The document has been published successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/compliance-documents'] });
      setIsPublishDialogOpen(false);
      setSelectedDocument(null);
    },
    onError: (error: any) => {
      toast({
        title: "Publishing Failed",
        description: error.message || "Failed to publish document",
        variant: "destructive"
      });
    }
  });

  // Event handlers
  const handleGenerateDocument = () => {
    if (!generateForm.documentType) {
      toast({
        title: "Document Type Required",
        description: "Please select a document type to generate.",
        variant: "destructive"
      });
      return;
    }

    generateDocumentMutation.mutate(generateForm);
  };

  const handlePreviewDocument = () => {
    if (!generateForm.documentType) {
      toast({
        title: "Document Type Required",
        description: "Please select a document type to preview.",
        variant: "destructive"
      });
      return;
    }

    previewDocumentMutation.mutate({
      documentType: generateForm.documentType,
      templateId: generateForm.templateId || null
    });
  };

  const handleEditDocument = (document: ComplianceDocument) => {
    setSelectedDocument(document);
    setEditForm({
      title: document.title,
      description: document.description || '',
      content: document.content
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateDocument = () => {
    if (!selectedDocument) return;

    updateDocumentMutation.mutate({
      id: selectedDocument.id,
      data: editForm
    });
  };

  const handlePublishDocument = (document: ComplianceDocument) => {
    setSelectedDocument(document);
    setPublishForm({
      isPublic: true,
      publicUrl: `/${document.documentType}`,
      passwordProtected: false,
      accessPassword: '',
      publicationNotes: ''
    });
    setIsPublishDialogOpen(true);
  };

  const handlePublish = () => {
    if (!selectedDocument) return;

    publishDocumentMutation.mutate({
      id: selectedDocument.id,
      data: publishForm
    });
  };

  const getFilteredTemplates = (documentType: string) => {
    return templates.filter((template: ComplianceDocumentTemplate) => 
      template.documentType === documentType && template.isActive
    );
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="compliance-documents-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="page-title">
            Compliance Documents
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2" data-testid="page-description">
            Generate, manage, and publish legal compliance documents for your organisation
          </p>
        </div>
        <Button 
          onClick={() => setIsGenerateDialogOpen(true)}
          className="flex items-center gap-2"
          data-testid="button-generate-document"
        >
          <FileText className="h-4 w-4" />
          Generate Document
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
          <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
          <TabsTrigger value="audit" data-testid="tab-audit">Audit Trail</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Generated Documents
              </CardTitle>
              <CardDescription>
                Manage your organisation's compliance documents and their publication status
              </CardDescription>
            </CardHeader>
            <CardContent>
              {documentsLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center p-8">
                  <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Documents Generated
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Generate your first compliance document to get started
                  </p>
                  <Button 
                    onClick={() => setIsGenerateDialogOpen(true)}
                    data-testid="button-generate-first-document"
                  >
                    Generate Document
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Compliance</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Last Modified</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {documents.map((document: ComplianceDocument) => (
                        <TableRow key={document.id} data-testid={`document-row-${document.id}`}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{document.title}</div>
                              {document.description && (
                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                  {document.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {DOCUMENT_TYPES.find(t => t.value === document.documentType)?.label || document.documentType}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(document.status)}>
                              {document.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getComplianceStatusColor(document.complianceStatus)}>
                              {document.complianceStatus.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>{document.version}</TableCell>
                          <TableCell>
                            {document.lastModifiedAt ? formatDate(document.lastModifiedAt) : formatDate(document.createdAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditDocument(document)}
                                data-testid={`button-edit-${document.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              {document.status !== 'published' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handlePublishDocument(document)}
                                  data-testid={`button-publish-${document.id}`}
                                >
                                  <Send className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedDocument(document)}
                                data-testid={`button-view-${document.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Templates Tab */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Document Templates
              </CardTitle>
              <CardDescription>
                Available templates for generating compliance documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              {templatesLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {DOCUMENT_TYPES.map(docType => {
                    const templatesForType = getFilteredTemplates(docType.value);
                    return (
                      <Card key={docType.value} className="border-2">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg">{docType.label}</CardTitle>
                          <CardDescription className="text-sm">
                            {docType.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                              {templatesForType.length} template{templatesForType.length !== 1 ? 's' : ''} available
                            </div>
                            {templatesForType.length > 0 && (
                              <div className="space-y-1">
                                {templatesForType.map((template: ComplianceDocumentTemplate) => (
                                  <div key={template.id} className="flex items-center justify-between text-sm">
                                    <span>{template.name}</span>
                                    {template.isDefault && (
                                      <Badge variant="secondary" className="text-xs">Default</Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                            <Button
                              size="sm"
                              className="w-full mt-2"
                              onClick={() => {
                                setGenerateForm({ ...generateForm, documentType: docType.value });
                                setIsGenerateDialogOpen(true);
                              }}
                              data-testid={`button-generate-${docType.value}`}
                            >
                              Generate {docType.label}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Trail Tab */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Document Audit Trail
              </CardTitle>
              <CardDescription>
                Track all changes and activities for compliance documents
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedDocument ? (
                <>
                  <div className="mb-4">
                    <h3 className="font-medium">Audit Trail for: {selectedDocument.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Document ID: {selectedDocument.id}</p>
                  </div>
                  {auditLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : auditTrail.length === 0 ? (
                    <div className="text-center p-8">
                      <History className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                      <p className="text-gray-500 dark:text-gray-400">No audit entries found</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {auditTrail.map((entry: DocumentAuditEntry) => (
                        <div key={entry.id} className="border-l-2 border-blue-200 pl-4 pb-4">
                          <div className="flex items-center justify-between">
                            <div className="font-medium capitalize">{entry.action}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {formatDate(entry.timestamp)}
                            </div>
                          </div>
                          {entry.actionDetails && (
                            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {entry.actionDetails}
                            </div>
                          )}
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            By: {entry.actionBy} • IP: {entry.ipAddress}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center p-8">
                  <History className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400">
                    Select a document from the Documents tab to view its audit trail
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{documents.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Published</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {documents.filter((d: ComplianceDocument) => d.status === 'published').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {documents.filter((d: ComplianceDocument) => d.complianceStatus === 'pending_review').length}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Templates Available</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{templates.length}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Document Types Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {DOCUMENT_TYPES.map(docType => {
                  const count = documents.filter((d: ComplianceDocument) => d.documentType === docType.value).length;
                  const published = documents.filter((d: ComplianceDocument) => 
                    d.documentType === docType.value && d.status === 'published'
                  ).length;
                  
                  return (
                    <div key={docType.value} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <div className="font-medium">{docType.label}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {docType.description}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{count} total</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {published} published
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Generate Document Dialog */}
      <Dialog open={isGenerateDialogOpen} onOpenChange={setIsGenerateDialogOpen}>
        <DialogContent className="max-w-2xl" data-testid="dialog-generate-document">
          <DialogHeader>
            <DialogTitle>Generate Compliance Document</DialogTitle>
            <DialogDescription>
              Create a new compliance document using your organisation's data and regulatory templates
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="documentType">Document Type *</Label>
              <Select 
                value={generateForm.documentType} 
                onValueChange={(value) => setGenerateForm({ ...generateForm, documentType: value })}
              >
                <SelectTrigger data-testid="select-document-type">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-sm text-gray-500">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {generateForm.documentType && (
              <div className="space-y-2">
                <Label htmlFor="templateId">Template (Optional)</Label>
                <Select 
                  value={generateForm.templateId} 
                  onValueChange={(value) => setGenerateForm({ ...generateForm, templateId: value })}
                >
                  <SelectTrigger data-testid="select-template">
                    <SelectValue placeholder="Use default template" />
                  </SelectTrigger>
                  <SelectContent>
                    {getFilteredTemplates(generateForm.documentType).map((template: ComplianceDocumentTemplate) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div>
                          <div className="font-medium">{template.name}</div>
                          {template.description && (
                            <div className="text-sm text-gray-500">{template.description}</div>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Custom Title (Optional)</Label>
              <Input
                id="title"
                value={generateForm.title}
                onChange={(e) => setGenerateForm({ ...generateForm, title: e.target.value })}
                placeholder="Override default title"
                data-testid="input-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={generateForm.description}
                onChange={(e) => setGenerateForm({ ...generateForm, description: e.target.value })}
                placeholder="Brief description of this document"
                data-testid="textarea-description"
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={handlePreviewDocument}
              disabled={previewDocumentMutation.isPending || !generateForm.documentType}
              data-testid="button-preview"
            >
              {previewDocumentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Preview...
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </>
              )}
            </Button>
            <Button 
              onClick={handleGenerateDocument}
              disabled={generateDocumentMutation.isPending || !generateForm.documentType}
              data-testid="button-generate"
            >
              {generateDocumentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Document
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Document Dialog */}
      <Dialog open={isPreviewDialogOpen} onOpenChange={setIsPreviewDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="dialog-preview-document">
          <DialogHeader>
            <DialogTitle>{previewDocument?.title}</DialogTitle>
            <DialogDescription>
              Document preview with {previewDocument?.wordCount} words • {previewDocument?.readingTime} min read
            </DialogDescription>
          </DialogHeader>
          
          {previewDocument && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {previewDocument.regulatoryRequirements.map((req, index) => (
                  <Badge key={index} variant="outline">{req}</Badge>
                ))}
              </div>
              
              <Separator />
              
              <div 
                className="prose max-w-none dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: previewDocument.htmlContent || previewDocument.content }}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewDialogOpen(false)}>
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Document Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" data-testid="dialog-edit-document">
          <DialogHeader>
            <DialogTitle>Edit Document</DialogTitle>
            <DialogDescription>
              Make changes to the document content and metadata
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editTitle">Title</Label>
              <Input
                id="editTitle"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                data-testid="input-edit-title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editDescription">Description</Label>
              <Textarea
                id="editDescription"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                data-testid="textarea-edit-description"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="editContent">Content</Label>
              <Textarea
                id="editContent"
                value={editForm.content}
                onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                className="min-h-[300px] font-mono text-sm"
                data-testid="textarea-edit-content"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdateDocument}
              disabled={updateDocumentMutation.isPending}
              data-testid="button-save-changes"
            >
              {updateDocumentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Document Dialog */}
      <Dialog open={isPublishDialogOpen} onOpenChange={setIsPublishDialogOpen}>
        <DialogContent data-testid="dialog-publish-document">
          <DialogHeader>
            <DialogTitle>Publish Document</DialogTitle>
            <DialogDescription>
              Configure publication settings for this compliance document
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="isPublic"
                checked={publishForm.isPublic}
                onChange={(e) => setPublishForm({ ...publishForm, isPublic: e.target.checked })}
                className="rounded"
                data-testid="checkbox-is-public"
              />
              <Label htmlFor="isPublic">Make publicly accessible</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="publicUrl">Public URL Path</Label>
              <Input
                id="publicUrl"
                value={publishForm.publicUrl}
                onChange={(e) => setPublishForm({ ...publishForm, publicUrl: e.target.value })}
                placeholder="/privacy-policy"
                data-testid="input-public-url"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="passwordProtected"
                checked={publishForm.passwordProtected}
                onChange={(e) => setPublishForm({ ...publishForm, passwordProtected: e.target.checked })}
                className="rounded"
                data-testid="checkbox-password-protected"
              />
              <Label htmlFor="passwordProtected">Password protect document</Label>
            </div>

            {publishForm.passwordProtected && (
              <div className="space-y-2">
                <Label htmlFor="accessPassword">Access Password</Label>
                <Input
                  id="accessPassword"
                  type="password"
                  value={publishForm.accessPassword}
                  onChange={(e) => setPublishForm({ ...publishForm, accessPassword: e.target.value })}
                  data-testid="input-access-password"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="publicationNotes">Publication Notes (Optional)</Label>
              <Textarea
                id="publicationNotes"
                value={publishForm.publicationNotes}
                onChange={(e) => setPublishForm({ ...publishForm, publicationNotes: e.target.value })}
                placeholder="Internal notes about this publication"
                data-testid="textarea-publication-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPublishDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handlePublish}
              disabled={publishDocumentMutation.isPending}
              data-testid="button-publish"
            >
              {publishDocumentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Publish Document
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}