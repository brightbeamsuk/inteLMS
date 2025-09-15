import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useIsGdprEnabled } from "@/hooks/useGdpr";
import { 
  Baby,
  User,
  UserCheck,
  AlertTriangle,
  Shield,
  Heart,
  Calendar,
  Info,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { DateOfBirthInput } from "./DateOfBirthInput";
import { ParentalConsentModal } from "./ParentalConsentModal";
import { AgeGateWarning } from "./AgeGateWarning";

export interface AgeVerificationResult {
  ageGroup: 'child_under_13' | 'child_13_to_16' | 'adult_over_16';
  requiresParentalConsent: boolean;
  canProceed: boolean;
  verificationId?: string;
  restrictions?: string[];
}

interface AgeVerificationWidgetProps {
  userId?: string;
  onVerificationComplete?: (result: AgeVerificationResult) => void;
  onParentalConsentRequired?: (childUserId: string) => void;
  showHeader?: boolean;
  variant?: 'registration' | 'profile' | 'standalone';
  className?: string;
}

// Age group definitions with enhanced information
const ageGroupInfo = {
  child_under_13: {
    title: "Under 13 Years",
    icon: Baby,
    color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    description: "Enhanced protection required under UK GDPR Article 8",
    requirements: [
      "Parental consent mandatory",
      "Limited data collection",
      "Enhanced privacy protections",
      "No marketing communications"
    ],
    warningLevel: "high" as const
  },
  child_13_to_16: {
    title: "13-16 Years",
    icon: User,
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    description: "Transitional age group with additional safeguards",
    requirements: [
      "Enhanced privacy settings",
      "Restricted data sharing",
      "Limited profiling activities",
      "Parental notification recommended"
    ],
    warningLevel: "medium" as const
  },
  adult_over_16: {
    title: "16+ Years",
    icon: UserCheck,
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    description: "Full capacity to provide consent",
    requirements: [
      "Standard privacy protections",
      "Full platform access",
      "Marketing opt-in available",
      "Complete data processing rights"
    ],
    warningLevel: "none" as const
  }
};

export function AgeVerificationWidget({
  userId,
  onVerificationComplete,
  onParentalConsentRequired,
  showHeader = true,
  variant = 'registration',
  className = ""
}: AgeVerificationWidgetProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isGdprEnabled = useIsGdprEnabled();
  
  // State management
  const [dateOfBirth, setDateOfBirth] = useState<string>("");
  const [ageGroup, setAgeGroup] = useState<AgeVerificationResult['ageGroup'] | null>(null);
  const [verificationResult, setVerificationResult] = useState<AgeVerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showParentalConsentModal, setShowParentalConsentModal] = useState(false);
  const [showAgeGateWarning, setShowAgeGateWarning] = useState(false);
  const [hasAcceptedRestrictions, setHasAcceptedRestrictions] = useState(false);

  // Calculate age group based on date of birth
  const calculateAgeGroup = (dob: string): AgeVerificationResult['ageGroup'] => {
    const birthDate = new Date(dob);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) 
      ? age - 1 
      : age;

    if (actualAge < 13) return 'child_under_13';
    if (actualAge < 16) return 'child_13_to_16';
    return 'adult_over_16';
  };

  // Create age verification mutation
  const createVerificationMutation = useMutation<any, Error, {
    userId?: string;
    dateOfBirth: string;
    verificationMethod: string;
    evidenceType: string;
  }>({
    mutationFn: (data: {
      userId?: string;
      dateOfBirth: string;
      verificationMethod: string;
      evidenceType: string;
    }) => 
      apiRequest('POST', '/api/gdpr/age-verification', data).then(res => res.json()),
    onSuccess: (data) => {
      const result: AgeVerificationResult = {
        ageGroup: data.ageGroup,
        requiresParentalConsent: data.parentalConsentRequired,
        canProceed: data.verificationStatus === 'verified' || data.ageGroup === 'adult_over_16',
        verificationId: data.id,
        restrictions: data.ageGroup === 'child_under_13' 
          ? ['limited_data_collection', 'no_marketing', 'enhanced_privacy']
          : data.ageGroup === 'child_13_to_16'
          ? ['restricted_sharing', 'limited_profiling']
          : []
      };
      
      setVerificationResult(result);
      onVerificationComplete?.(result);
      
      if (result.requiresParentalConsent && data.ageGroup === 'child_under_13') {
        setShowParentalConsentModal(true);
        onParentalConsentRequired?.(userId || data.userId);
      }

      toast({
        title: "Age verification completed",
        description: `Account classified as: ${ageGroupInfo[data.ageGroup]?.title || data.ageGroup}`
      });
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Verification failed",
        description: error.message || "Failed to verify age. Please try again."
      });
    }
  });

  // Handle date of birth change
  const handleDateOfBirthChange = (dob: string) => {
    setDateOfBirth(dob);
    if (dob) {
      const calculatedAgeGroup = calculateAgeGroup(dob);
      setAgeGroup(calculatedAgeGroup);
      
      // Show age gate warning for children under 13
      if (calculatedAgeGroup === 'child_under_13') {
        setShowAgeGateWarning(true);
      } else {
        setShowAgeGateWarning(false);
        setHasAcceptedRestrictions(true);
      }
    } else {
      setAgeGroup(null);
      setShowAgeGateWarning(false);
      setHasAcceptedRestrictions(false);
    }
  };

  // Handle verification submission
  const handleVerify = async () => {
    if (!dateOfBirth || !ageGroup) {
      toast({
        variant: "destructive",
        title: "Date required",
        description: "Please enter your date of birth to continue."
      });
      return;
    }

    if (ageGroup === 'child_under_13' && !hasAcceptedRestrictions) {
      toast({
        variant: "destructive",
        title: "Acceptance required",
        description: "Please acknowledge the restrictions for child accounts."
      });
      return;
    }

    setIsVerifying(true);
    
    try {
      await createVerificationMutation.mutateAsync({
        userId,
        dateOfBirth,
        verificationMethod: 'self_declaration',
        evidenceType: 'date_of_birth'
      });
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle restriction acceptance
  const handleAcceptRestrictions = () => {
    setHasAcceptedRestrictions(true);
    setShowAgeGateWarning(false);
  };

  // Don't render if GDPR is not enabled
  if (!isGdprEnabled) {
    return null;
  }

  return (
    <div className={`space-y-4 ${className}`} data-testid="widget-age-verification">
      {showHeader && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-blue-600" />
              Age Verification
            </CardTitle>
            <CardDescription>
              We need to verify your age to ensure appropriate privacy protections under UK GDPR Article 8
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Date of Birth Input */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Enter Your Date of Birth</CardTitle>
          <CardDescription>
            This information helps us provide age-appropriate privacy protections
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DateOfBirthInput
            value={dateOfBirth}
            onChange={handleDateOfBirthChange}
            disabled={isVerifying}
            data-testid="input-date-of-birth"
          />

          {/* Age Group Display */}
          {ageGroup && (
            <div className="space-y-3">
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {(() => {
                    const IconComponent = ageGroupInfo[ageGroup]?.icon;
                    return IconComponent ? <IconComponent className="h-5 w-5 text-muted-foreground" /> : null;
                  })()}
                  <div>
                    <p className="font-medium">Age Category</p>
                    <p className="text-sm text-muted-foreground">
                      {ageGroupInfo[ageGroup].description}
                    </p>
                  </div>
                </div>
                <Badge className={ageGroupInfo[ageGroup].color} data-testid={`badge-age-group-${ageGroup}`}>
                  {ageGroupInfo[ageGroup].title}
                </Badge>
              </div>

              {/* Protection Requirements */}
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Privacy Protections
                </h4>
                <ul className="text-sm space-y-1">
                  {ageGroupInfo[ageGroup].requirements.map((requirement, index) => (
                    <li key={index} className="flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      {requirement}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Verification Button */}
          {dateOfBirth && ageGroup && (
            <div className="pt-4">
              <Button
                onClick={handleVerify}
                disabled={isVerifying || (ageGroup === 'child_under_13' && !hasAcceptedRestrictions)}
                className="w-full"
                data-testid="button-verify-age"
              >
                {isVerifying ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4 mr-2" />
                    Verify Age
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Verification Result */}
      {verificationResult && (
        <Card data-testid="card-verification-result">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Age Verification Complete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Age Category:</span>
                <Badge className={ageGroupInfo[verificationResult.ageGroup].color}>
                  {ageGroupInfo[verificationResult.ageGroup].title}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Parental Consent:</span>
                <Badge variant={verificationResult.requiresParentalConsent ? "destructive" : "secondary"}>
                  {verificationResult.requiresParentalConsent ? "Required" : "Not Required"}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Can Proceed:</span>
                <Badge variant={verificationResult.canProceed ? "default" : "destructive"}>
                  {verificationResult.canProceed ? "Yes" : "Awaiting Consent"}
                </Badge>
              </div>

              {verificationResult.restrictions && verificationResult.restrictions.length > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <h5 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    Account Restrictions
                  </h5>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    {verificationResult.restrictions.map((restriction, index) => (
                      <li key={index}>• {restriction.replace(/_/g, ' ')}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Age Gate Warning Modal */}
      <AgeGateWarning
        isOpen={showAgeGateWarning}
        onClose={() => setShowAgeGateWarning(false)}
        onAccept={handleAcceptRestrictions}
        ageGroup={ageGroup}
      />

      {/* Parental Consent Modal */}
      <ParentalConsentModal
        isOpen={showParentalConsentModal}
        onClose={() => setShowParentalConsentModal(false)}
        childUserId={userId}
        childAgeGroup={ageGroup}
      />
    </div>
  );
}