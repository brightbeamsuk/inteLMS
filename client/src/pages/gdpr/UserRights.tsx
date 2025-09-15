import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useIsGdprEnabled } from "@/hooks/useGdpr";
import { insertUserRightRequestSchema, type UserRightRequest } from "@shared/schema";
import { z } from "zod";
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
  Plus,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

// User rights type information for UI display
const userRightsInfo = {
  access: {
    title: "Right of Access",
    description: "Request a copy of all personal data we hold about you, including how it's being processed.",
    icon: Eye,
    article: "Article 15",
    details: "You have the right to know what personal data we have about you, why we're processing it, who we share it with, and how long we'll keep it. We'll provide this information in a commonly used electronic format.",
    estimatedTime: "Up to 30 days"
  },
  rectification: {
    title: "Right to Rectification",
    description: "Request correction of inaccurate or incomplete personal data.",
    icon: Edit,
    article: "Article 16",
    details: "If you believe any of your personal data is inaccurate or incomplete, you can request that we correct or complete it. We'll also notify any third parties we've shared this data with.",
    estimatedTime: "Up to 30 days"
  },
  erasure: {
    title: "Right to Erasure (Right to be Forgotten)",
    description: "Request deletion of your personal data in certain circumstances.",
    icon: Trash2,
    article: "Article 17",
    details: "You can request deletion of your personal data when it's no longer necessary for the original purpose, you withdraw consent, or it has been unlawfully processed. Please note that some data may need to be retained for legal obligations.",
    estimatedTime: "Up to 30 days"
  },
  restriction: {
    title: "Right to Restriction of Processing",
    description: "Request that we limit how we process your personal data.",
    icon: Lock,
    article: "Article 18",
    details: "You can request that we restrict processing of your personal data (but not delete it) if you contest its accuracy, object to processing, or need it for legal claims.",
    estimatedTime: "Up to 30 days"
  },
  objection: {
    title: "Right to Object",
    description: "Object to processing of your personal data for certain purposes.",
    icon: Shield,
    article: "Article 21",
    details: "You can object to processing of your personal data for direct marketing, research purposes, or when processing is based on legitimate interests. We must stop processing unless we have compelling legitimate grounds.",
    estimatedTime: "Up to 30 days"
  },
  portability: {
    title: "Right to Data Portability",
    description: "Request your personal data in a portable format to transfer to another service.",
    icon: Download,
    article: "Article 20",
    details: "You can request that we provide your personal data in a structured, commonly used, machine-readable format so you can transfer it to another data controller.",
    estimatedTime: "Up to 30 days"
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

export function UserRights() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isGdprEnabled = useIsGdprEnabled();
  
  const [selectedRightType, setSelectedRightType] = useState<string>("");
  const [requestDescription, setRequestDescription] = useState("");
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);

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

  // Fetch user's existing rights requests
  const { data: userRequests, isLoading } = useQuery<UserRightRequest[]>({
    queryKey: ['/api/gdpr/user-rights'],
    enabled: !!user,
  });

  // Submit new user rights request mutation
  const submitRequestMutation = useMutation({
    mutationFn: async (data: { type: string; description: string }) => {
      return await apiRequest('/api/gdpr/user-rights', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/user-rights'] });
      setIsSubmitDialogOpen(false);
      setSelectedRightType("");
      setRequestDescription("");
      toast({
        title: "Request submitted successfully",
        description: "Your rights request has been submitted and will be reviewed by our team.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit rights request",
        variant: "destructive",
      });
    },
  });

  const handleSubmitRequest = () => {
    if (!selectedRightType || !requestDescription.trim()) {
      toast({
        title: "Validation Error",
        description: "Please select a right type and provide a description.",
        variant: "destructive",
      });
      return;
    }

    if (requestDescription.length < 10) {
      toast({
        title: "Validation Error", 
        description: "Please provide at least 10 characters describing your request.",
        variant: "destructive",
      });
      return;
    }

    submitRequestMutation.mutate({
      type: selectedRightType,
      description: requestDescription
    });
  };

  // Check if user has pending request of selected type
  const hasPendingRequest = (type: string) => {
    return userRequests?.some(request => 
      request.type === type && ['pending', 'in_progress'].includes(request.status)
    );
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

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">Loading your rights requests...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Your Data Rights
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Under UK GDPR and the Data Protection Act 2018, you have several rights regarding your personal data.
            Use the options below to exercise these rights.
          </p>
        </div>

        {/* Rights Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(userRightsInfo).map(([key, info]) => {
            const Icon = info.icon;
            const isPending = hasPendingRequest(key);
            
            return (
              <Card key={key} className={`transition-all duration-200 hover:shadow-md ${isPending ? 'ring-2 ring-blue-200 dark:ring-blue-800' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <div>
                        <CardTitle className="text-sm font-medium">{info.title}</CardTitle>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{info.article}</div>
                      </div>
                    </div>
                    {isPending && (
                      <Badge variant="outline" className="text-xs">
                        Active Request
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription className="text-sm mb-3">
                    {info.description}
                  </CardDescription>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full">
                        Learn More
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle className="flex items-center space-x-2">
                          <Icon className="h-5 w-5" />
                          <span>{info.title}</span>
                        </DialogTitle>
                        <DialogDescription className="space-y-3 text-left">
                          <p>{info.details}</p>
                          <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
                            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                              Expected Response Time: {info.estimatedTime}
                            </p>
                          </div>
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button 
                          onClick={() => {
                            setSelectedRightType(key);
                            setIsSubmitDialogOpen(true);
                          }}
                          disabled={isPending}
                          data-testid={`button-submit-${key}`}
                        >
                          {isPending ? 'Request Already Submitted' : 'Submit Request'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Submit Button */}
        <div className="text-center">
          <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-new-request">
                <Plus className="h-4 w-4 mr-2" />
                Submit New Rights Request
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Submit Data Rights Request</DialogTitle>
                <DialogDescription>
                  Choose the type of rights request you'd like to submit and provide details about your request.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Type of Request</label>
                  <Select value={selectedRightType} onValueChange={setSelectedRightType}>
                    <SelectTrigger data-testid="select-right-type">
                      <SelectValue placeholder="Select your rights request type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(userRightsInfo).map(([key, info]) => {
                        const isPending = hasPendingRequest(key);
                        return (
                          <SelectItem 
                            key={key} 
                            value={key} 
                            disabled={isPending}
                            data-testid={`option-${key}`}
                          >
                            <div className="flex items-center justify-between w-full">
                              <span>{info.title}</span>
                              {isPending && <span className="text-xs text-gray-500 ml-2">(Pending)</span>}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Request Description</label>
                  <Textarea
                    placeholder="Please describe your request in detail. Include any specific information that would help us process your request more efficiently."
                    value={requestDescription}
                    onChange={(e) => setRequestDescription(e.target.value)}
                    className="min-h-[100px]"
                    data-testid="textarea-description"
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Minimum 10 characters ({requestDescription.length}/10)
                  </div>
                </div>
              </div>

              <DialogFooter className="space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setIsSubmitDialogOpen(false)}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmitRequest}
                  disabled={submitRequestMutation.isPending || !selectedRightType || requestDescription.length < 10}
                  data-testid="button-submit"
                >
                  {submitRequestMutation.isPending ? 'Submitting...' : 'Submit Request'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* User's Request History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>Your Request History</span>
            </CardTitle>
            <CardDescription>
              View the status and details of all your data rights requests.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!userRequests || userRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>You haven't submitted any rights requests yet.</p>
                <p className="text-sm mt-1">Use the options above to exercise your data rights.</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-4">
                  {userRequests.map((request) => {
                    const rightInfo = userRightsInfo[request.type as keyof typeof userRightsInfo];
                    const Icon = rightInfo?.icon || FileText;
                    
                    return (
                      <div key={request.id} className="border rounded-lg p-4 space-y-3" data-testid={`request-${request.id}`}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <Icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                            <div>
                              <h4 className="font-medium" data-testid={`text-title-${request.id}`}>
                                {rightInfo?.title || request.type}
                              </h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Submitted {formatDate(request.requestedAt)}
                              </p>
                            </div>
                          </div>
                          <div data-testid={`status-${request.id}`}>
                            {getStatusBadge(request.status)}
                          </div>
                        </div>
                        
                        <p className="text-sm text-gray-700 dark:text-gray-300" data-testid={`text-description-${request.id}`}>
                          {request.description}
                        </p>
                        
                        {request.adminNotes && (
                          <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
                            <p className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                              Admin Response:
                            </p>
                            <p className="text-sm text-blue-700 dark:text-blue-300" data-testid={`text-admin-notes-${request.id}`}>
                              {request.adminNotes}
                            </p>
                          </div>
                        )}
                        
                        {request.rejectionReason && (
                          <div className="bg-red-50 dark:bg-red-900/30 p-3 rounded-lg">
                            <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                              Rejection Reason:
                            </p>
                            <p className="text-sm text-red-700 dark:text-red-300" data-testid={`text-rejection-reason-${request.id}`}>
                              {request.rejectionReason}
                            </p>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                          <div className="space-x-4">
                            {request.verifiedAt && (
                              <span>Verified: {formatDate(request.verifiedAt)}</span>
                            )}
                            {request.completedAt && (
                              <span>Completed: {formatDate(request.completedAt)}</span>
                            )}
                          </div>
                          
                          {request.status === 'completed' && ['access', 'portability'].includes(request.type) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                try {
                                  window.open(`/api/gdpr/user-rights/${request.id}/export?format=json`, '_blank');
                                } catch (error) {
                                  toast({
                                    title: "Error",
                                    description: "Failed to download data export",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              data-testid={`button-download-${request.id}`}
                            >
                              <Download className="h-3 w-3 mr-1" />
                              Download Data
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Information Footer */}
        <Card className="bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium">Important Information:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
                  <li>We will respond to your request within 30 days of verification</li>
                  <li>You may be asked to provide additional information to verify your identity</li>
                  <li>Some requests may be refused if they are manifestly unfounded or excessive</li>
                  <li>For questions about your rights, contact our Data Protection Officer</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}