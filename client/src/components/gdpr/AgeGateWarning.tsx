import { 
  Baby,
  User,
  UserCheck,
  AlertTriangle,
  Shield,
  Heart,
  Lock,
  Eye,
  Bell,
  X,
  CheckCircle,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AgeGateWarningProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  ageGroup: 'child_under_13' | 'child_13_to_16' | 'adult_over_16' | null;
}

// Age-specific protection information
const protectionInfo = {
  child_under_13: {
    title: "Special Protection for Children Under 13",
    icon: Baby,
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    warningLevel: "high" as const,
    description: "Your account will have enhanced privacy protections as required by UK GDPR Article 8.",
    restrictions: [
      {
        icon: Lock,
        title: "Limited Data Collection",
        description: "We collect only essential information needed for educational purposes"
      },
      {
        icon: Eye,
        title: "No Marketing Communications",
        description: "Your account will not receive any marketing or promotional messages"
      },
      {
        icon: Shield,
        title: "Enhanced Privacy Settings",
        description: "Stronger privacy defaults with limited data sharing"
      },
      {
        icon: Bell,
        title: "Parental Notifications",
        description: "Parents receive notifications about account activities and changes"
      }
    ],
    requirements: [
      "Parental consent is mandatory before account activation",
      "Parent/guardian must verify their identity",
      "Regular consent reviews to ensure continued protection",
      "Limited functionality until parental consent is obtained"
    ],
    legalBasis: "UK GDPR Article 8 - Protection of children's personal data"
  },
  child_13_to_16: {
    title: "Enhanced Protection for Teens (13-16)",
    icon: User,
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    warningLevel: "medium" as const,
    description: "Your account includes additional safeguards appropriate for your age group.",
    restrictions: [
      {
        icon: Shield,
        title: "Privacy by Design",
        description: "Stronger privacy settings enabled by default"
      },
      {
        icon: Lock,
        title: "Restricted Data Sharing",
        description: "Limited sharing of personal information with third parties"
      },
      {
        icon: Eye,
        title: "Limited Profiling",
        description: "Reduced automated decision-making and profiling activities"
      },
      {
        icon: Bell,
        title: "Parental Awareness",
        description: "Option for parental notifications about significant changes"
      }
    ],
    requirements: [
      "Enhanced privacy settings applied automatically",
      "Restricted marketing and promotional communications",
      "Additional consent required for data sharing",
      "Regular privacy setting reviews"
    ],
    legalBasis: "Enhanced protection for adolescents under UK GDPR"
  },
  adult_over_16: {
    title: "Standard Adult Privacy Protection",
    icon: UserCheck,
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    warningLevel: "none" as const,
    description: "You have full capacity to provide consent for data processing.",
    restrictions: [],
    requirements: [
      "Standard privacy protections apply",
      "Full access to platform features",
      "Ability to opt-in to marketing communications",
      "Complete control over privacy settings"
    ],
    legalBasis: "Standard GDPR protections for adults"
  }
};

export function AgeGateWarning({
  isOpen,
  onClose,
  onAccept,
  ageGroup
}: AgeGateWarningProps) {
  if (!ageGroup || ageGroup === 'adult_over_16') {
    return null;
  }

  const info = protectionInfo[ageGroup];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto" 
        data-testid="modal-age-gate-warning"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <info.icon className="h-6 w-6 text-primary" />
            {info.title}
          </DialogTitle>
          <DialogDescription>
            {info.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Warning Alert */}
          <Alert variant={info.warningLevel === 'high' ? 'destructive' : 'default'} data-testid="alert-age-warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Important Notice</AlertTitle>
            <AlertDescription>
              {ageGroup === 'child_under_13' 
                ? "This account is for a child under 13 years old. Special privacy protections and parental consent requirements apply under UK GDPR Article 8."
                : "This account is for a user between 13-16 years old. Enhanced privacy protections will be applied to ensure age-appropriate data handling."
              }
            </AlertDescription>
          </Alert>

          {/* Age Category Badge */}
          <div className="flex justify-center">
            <Badge className={`${info.color} px-4 py-2 text-base`} data-testid="badge-age-category">
              {info.title}
            </Badge>
          </div>

          {/* Protection Measures */}
          {info.restrictions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5 text-green-600" />
                  Privacy Protection Measures
                </CardTitle>
                <CardDescription>
                  These protections are automatically applied to ensure your safety and privacy
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {info.restrictions.map((restriction, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <restriction.icon className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h4 className="font-medium text-sm">{restriction.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {restriction.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Requirements */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Info className="h-5 w-5 text-blue-600" />
                What This Means for You
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {info.requirements.map((requirement, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span>{requirement}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Legal Basis */}
          <Card className="bg-blue-50 dark:bg-blue-900/20">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm text-blue-900 dark:text-blue-100">
                    Legal Protection Basis
                  </h4>
                  <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">
                    {info.legalBasis}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Parental Consent Notice for Under 13 */}
          {ageGroup === 'child_under_13' && (
            <Alert data-testid="alert-parental-consent-required">
              <Heart className="h-4 w-4" />
              <AlertTitle>Parental Consent Required</AlertTitle>
              <AlertDescription>
                Before your account can be activated, we need to verify parental consent. 
                A parent or guardian will need to complete a verification process to confirm 
                they approve of your account creation and data processing.
              </AlertDescription>
            </Alert>
          )}

          <Separator />

          {/* Acknowledgment */}
          <div className="bg-muted/30 p-4 rounded-lg" data-testid="section-acknowledgment">
            <h4 className="font-medium mb-2">By continuing, you acknowledge that:</h4>
            <ul className="text-sm space-y-1 text-muted-foreground">
              <li>• You understand the privacy protections that will be applied to your account</li>
              <li>• {ageGroup === 'child_under_13' 
                ? 'Your parent or guardian must provide verified consent before account activation'
                : 'Enhanced privacy settings will be automatically enabled for your protection'
              }</li>
              <li>• These measures are designed to keep you safe and protect your personal information</li>
              <li>• You can review and understand our privacy policy with a parent or guardian</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={onClose}
            data-testid="button-cancel-age-gate"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button 
            onClick={onAccept}
            data-testid="button-accept-age-gate"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            I Understand & Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}