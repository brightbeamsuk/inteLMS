import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Heart,
  Baby,
  User,
  Mail,
  Phone,
  Video,
  FileText,
  CreditCard,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  Send,
  X,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface ParentalConsentModalProps {
  isOpen: boolean;
  onClose: () => void;
  childUserId?: string;
  childAgeGroup?: 'child_under_13' | 'child_13_to_16' | 'adult_over_16' | null;
  onConsentRequested?: (consentId: string) => void;
}

interface ConsentForm {
  parentName: string;
  parentEmail: string;
  parentPhoneNumber: string;
  relationshipToChild: 'parent' | 'guardian' | 'legal_representative';
  consentMechanism: 'email_verification' | 'video_call' | 'document_verification' | 'payment_card_verification';
  consentTypes: string[];
  additionalNotes: string;
}

const verificationMethods = {
  email_verification: {
    title: "Email Verification",
    icon: Mail,
    description: "Verify parental identity through email confirmation with verification code",
    duration: "5-10 minutes",
    requirements: ["Valid email address", "Access to email account"],
    securityLevel: "Medium"
  },
  video_call: {
    title: "Video Call Verification",
    icon: Video,
    description: "Personal video call with identity verification questions",
    duration: "15-20 minutes",
    requirements: ["Video calling capability", "Government-issued ID", "Scheduled appointment"],
    securityLevel: "High"
  },
  document_verification: {
    title: "Document Verification",
    icon: FileText,
    description: "Upload government-issued ID for automated verification",
    duration: "2-24 hours",
    requirements: ["Government-issued photo ID", "Clear document photos", "Selfie for comparison"],
    securityLevel: "High"
  },
  payment_card_verification: {
    title: "Payment Card Verification",
    icon: CreditCard,
    description: "Small charge to payment card for cardholder verification",
    duration: "1-3 business days",
    requirements: ["Valid payment card", "Billing address access", "Banking authorization"],
    securityLevel: "Very High"
  }
};

const defaultConsentTypes = [
  "account_creation",
  "data_processing",
  "educational_content",
  "progress_tracking",
  "communication_with_child"
];

export function ParentalConsentModal({
  isOpen,
  onClose,
  childUserId,
  childAgeGroup,
  onConsentRequested
}: ParentalConsentModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [step, setStep] = useState<'form' | 'method' | 'confirmation'>('form');
  const [form, setForm] = useState<ConsentForm>({
    parentName: "",
    parentEmail: "",
    parentPhoneNumber: "",
    relationshipToChild: "parent",
    consentMechanism: "email_verification",
    consentTypes: [...defaultConsentTypes],
    additionalNotes: ""
  });

  // Create parental consent request
  const createConsentMutation = useMutation<any, Error, Omit<ConsentForm, 'additionalNotes'> & { childUserId: string }>({
    mutationFn: (data: Omit<ConsentForm, 'additionalNotes'> & { childUserId: string }) => 
      apiRequest('POST', '/api/gdpr/parental-consent', data).then(res => res.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/gdpr/parental-consents'] });
      setStep('confirmation');
      onConsentRequested?.(data.id);
      
      toast({
        title: "Parental consent request created",
        description: "We've initiated the verification process. The parent will receive instructions shortly."
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Failed to create request",
        description: error.message || "Unable to create parental consent request. Please try again."
      });
    }
  });

  const handleFormSubmit = () => {
    // Validate required fields
    if (!form.parentName.trim()) {
      toast({
        variant: "destructive",
        title: "Parent name required",
        description: "Please enter the parent or guardian's full name."
      });
      return;
    }

    if (!form.parentEmail.trim() || !form.parentEmail.includes('@')) {
      toast({
        variant: "destructive",
        title: "Valid email required",
        description: "Please enter a valid email address for the parent or guardian."
      });
      return;
    }

    setStep('method');
  };

  const handleMethodSubmit = () => {
    if (!childUserId) {
      toast({
        variant: "destructive",
        title: "Child user ID missing",
        description: "Unable to proceed without child user identification."
      });
      return;
    }

    createConsentMutation.mutate({
      childUserId,
      parentName: form.parentName,
      parentEmail: form.parentEmail,
      parentPhoneNumber: form.parentPhoneNumber,
      relationshipToChild: form.relationshipToChild,
      consentMechanism: form.consentMechanism,
      consentTypes: form.consentTypes
    });
  };

  const handleClose = () => {
    setStep('form');
    setForm({
      parentName: "",
      parentEmail: "",
      parentPhoneNumber: "",
      relationshipToChild: "parent",
      consentMechanism: "email_verification",
      consentTypes: [...defaultConsentTypes],
      additionalNotes: ""
    });
    onClose();
  };

  const selectedMethod = verificationMethods[form.consentMechanism];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" data-testid="modal-parental-consent">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500" />
            Parental Consent Required
          </DialogTitle>
          <DialogDescription>
            {childAgeGroup === 'child_under_13' 
              ? "This account is for a child under 13. UK GDPR Article 8 requires verifiable parental consent."
              : "Enhanced parental involvement is recommended for this age group."
            }
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Parent Information Form */}
        {step === 'form' && (
          <div className="space-y-6">
            {/* Child Protection Notice */}
            <Alert data-testid="alert-child-protection">
              <Shield className="h-4 w-4" />
              <AlertTitle>Child Protection Notice</AlertTitle>
              <AlertDescription>
                We're committed to protecting children's privacy and safety online. This verification process ensures 
                that only authorized parents or guardians can provide consent for child accounts.
              </AlertDescription>
            </Alert>

            {/* Parent Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Parent/Guardian Information</h3>
              
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <Label htmlFor="parent-name">Full Name *</Label>
                  <Input
                    id="parent-name"
                    value={form.parentName}
                    onChange={(e) => setForm(prev => ({ ...prev, parentName: e.target.value }))}
                    placeholder="Enter parent or guardian's full name"
                    data-testid="input-parent-name"
                  />
                </div>

                <div>
                  <Label htmlFor="parent-email">Email Address *</Label>
                  <Input
                    id="parent-email"
                    type="email"
                    value={form.parentEmail}
                    onChange={(e) => setForm(prev => ({ ...prev, parentEmail: e.target.value }))}
                    placeholder="Enter email address"
                    data-testid="input-parent-email"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This email will receive verification instructions and consent confirmations
                  </p>
                </div>

                <div>
                  <Label htmlFor="parent-phone">Phone Number (Optional)</Label>
                  <Input
                    id="parent-phone"
                    type="tel"
                    value={form.parentPhoneNumber}
                    onChange={(e) => setForm(prev => ({ ...prev, parentPhoneNumber: e.target.value }))}
                    placeholder="Enter phone number"
                    data-testid="input-parent-phone"
                  />
                </div>

                <div>
                  <Label htmlFor="relationship">Relationship to Child *</Label>
                  <Select 
                    value={form.relationshipToChild} 
                    onValueChange={(value: any) => setForm(prev => ({ ...prev, relationshipToChild: value }))}
                  >
                    <SelectTrigger data-testid="select-relationship">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="guardian">Legal Guardian</SelectItem>
                      <SelectItem value="legal_representative">Legal Representative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Consent Types */}
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Consent Categories</h3>
              <p className="text-sm text-muted-foreground">
                Select the types of data processing you consent to for your child:
              </p>
              
              <div className="space-y-2">
                {defaultConsentTypes.map((consentType) => (
                  <div key={consentType} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id={`consent-${consentType}`}
                      checked={form.consentTypes.includes(consentType)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setForm(prev => ({ 
                            ...prev, 
                            consentTypes: [...prev.consentTypes, consentType] 
                          }));
                        } else {
                          setForm(prev => ({ 
                            ...prev, 
                            consentTypes: prev.consentTypes.filter(type => type !== consentType) 
                          }));
                        }
                      }}
                      data-testid={`checkbox-consent-${consentType}`}
                    />
                    <Label htmlFor={`consent-${consentType}`} className="text-sm capitalize">
                      {consentType.replace(/_/g, ' ')}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose} data-testid="button-cancel-form">
                Cancel
              </Button>
              <Button onClick={handleFormSubmit} data-testid="button-continue-form">
                Continue
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 2: Verification Method Selection */}
        {step === 'method' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">Choose Verification Method</h3>
              <p className="text-sm text-muted-foreground">
                Select how you'd like to verify your parental authority. Different methods offer varying levels 
                of security and processing time.
              </p>
            </div>

            <div className="space-y-3">
              {Object.entries(verificationMethods).map(([key, method]) => (
                <Card 
                  key={key} 
                  className={`cursor-pointer transition-colors ${
                    form.consentMechanism === key ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setForm(prev => ({ ...prev, consentMechanism: key as any }))}
                  data-testid={`card-method-${key}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <method.icon className="h-5 w-5 text-primary" />
                        <div>
                          <CardTitle className="text-base">{method.title}</CardTitle>
                          <CardDescription className="text-sm">
                            {method.description}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant={
                        method.securityLevel === 'Very High' ? 'default' :
                        method.securityLevel === 'High' ? 'secondary' : 'outline'
                      }>
                        {method.securityLevel}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium text-muted-foreground">Duration:</p>
                        <p>{method.duration}</p>
                      </div>
                      <div>
                        <p className="font-medium text-muted-foreground">Requirements:</p>
                        <ul className="text-xs space-y-1">
                          {method.requirements.slice(0, 2).map((req, idx) => (
                            <li key={idx}>• {req}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Selected Method Details */}
            <Card className="bg-blue-50 dark:bg-blue-900/20">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <selectedMethod.icon className="h-4 w-4" />
                  {selectedMethod.title} - What to Expect
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <p>{selectedMethod.description}</p>
                  <div>
                    <p className="font-medium mb-2">Requirements:</p>
                    <ul className="space-y-1">
                      {selectedMethod.requirements.map((req, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          {req}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Processing time: {selectedMethod.duration}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('form')} data-testid="button-back-method">
                Back
              </Button>
              <Button 
                onClick={handleMethodSubmit}
                disabled={createConsentMutation.isPending}
                data-testid="button-submit-method"
              >
                {createConsentMutation.isPending ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Creating Request...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Request
                  </>
                )}
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 'confirmation' && (
          <div className="space-y-6 text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-2">Parental Consent Request Submitted</h3>
              <p className="text-muted-foreground">
                We've sent verification instructions to <strong>{form.parentEmail}</strong>
              </p>
            </div>

            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4 text-left">
                  <h4 className="font-medium">Next Steps:</h4>
                  <ol className="space-y-2 text-sm">
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs">1</span>
                      <span>Check your email for verification instructions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs">2</span>
                      <span>Complete the {selectedMethod.title.toLowerCase()} process</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-xs">3</span>
                      <span>Your child's account will be activated once verified</span>
                    </li>
                  </ol>
                </div>
              </CardContent>
            </Card>

            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                The child's account will remain restricted until parental consent is verified. 
                This typically takes {selectedMethod.duration}.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button onClick={handleClose} data-testid="button-close-confirmation">
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}