import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, Shield } from "lucide-react";

// Password change form schema
const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters long"),
  confirmPassword: z.string().min(1, "Please confirm your new password")
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords do not match",
  path: ["confirmPassword"]
});

type PasswordChangeFormData = z.infer<typeof passwordChangeSchema>;

interface PasswordChangeModalProps {
  isOpen: boolean;
  onSuccess: (user: any) => void;
  userEmail: string;
}

export function PasswordChangeModal({ 
  isOpen, 
  onSuccess,
  userEmail 
}: PasswordChangeModalProps) {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch
  } = useForm<PasswordChangeFormData>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    }
  });

  const changePasswordMutation = useMutation({
    mutationFn: async (data: PasswordChangeFormData) => {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Password change failed');
      }
      
      return await response.json();
    },
    onSuccess: (response: any) => {
      toast({
        title: "Password Changed Successfully",
        description: "Your password has been updated. You can now access the application.",
        variant: "default",
      });
      reset();
      onSuccess(response.user);
    },
    onError: (error: any) => {
      toast({
        title: "Password Change Failed",
        description: error.message || "Failed to change password. Please try again.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: PasswordChangeFormData) => {
    changePasswordMutation.mutate(data);
  };

  // Don't render if not open
  if (!isOpen) return null;

  // Get current values for password strength indicator
  const newPassword = watch("newPassword");

  // Password strength calculation
  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(newPassword || "");
  const strengthText = ["Very Weak", "Weak", "Fair", "Good", "Strong", "Very Strong"][passwordStrength] || "Very Weak";
  const strengthColor = ["text-red-500", "text-red-400", "text-yellow-500", "text-yellow-400", "text-green-500", "text-green-600"][passwordStrength] || "text-red-500";

  return (
    <div className="modal modal-open" style={{ zIndex: 9999 }}>
      <div className="modal-box max-w-md relative">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-warning" />
          </div>
          <h3 className="font-bold text-xl mb-2" data-testid="modal-title">
            Password Change Required
          </h3>
          <p className="text-base-content/70 text-sm" data-testid="modal-description">
            For security reasons, you must change your temporary password before accessing the application.
          </p>
        </div>

        {/* User info */}
        <div className="bg-base-200 p-3 rounded-lg mb-6">
          <div className="flex items-center gap-2 text-sm">
            <Lock className="w-4 h-4 text-base-content/60" />
            <span className="font-medium">Account:</span>
            <span className="text-base-content/70">{userEmail}</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Current Password */}
          <div>
            <Label htmlFor="currentPassword" className="text-sm font-medium">
              Current Temporary Password
            </Label>
            <div className="relative mt-1">
              <Input
                id="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
                {...register("currentPassword")}
                placeholder="Enter your current password"
                className={errors.currentPassword ? "border-red-500" : ""}
                data-testid="input-current-password"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                data-testid="button-toggle-current-password"
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.currentPassword && (
              <p className="text-red-500 text-xs mt-1">{errors.currentPassword.message}</p>
            )}
          </div>

          {/* New Password */}
          <div>
            <Label htmlFor="newPassword" className="text-sm font-medium">
              New Password
            </Label>
            <div className="relative mt-1">
              <Input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                {...register("newPassword")}
                placeholder="Enter your new password"
                className={errors.newPassword ? "border-red-500" : ""}
                data-testid="input-new-password"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowNewPassword(!showNewPassword)}
                data-testid="button-toggle-new-password"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.newPassword && (
              <p className="text-red-500 text-xs mt-1">{errors.newPassword.message}</p>
            )}
            {/* Password Strength Indicator */}
            {newPassword && (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-base-300 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${strengthColor.replace('text-', 'bg-')}`}
                      style={{ width: `${(passwordStrength / 6) * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${strengthColor}`}>
                    {strengthText}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <Label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm New Password
            </Label>
            <div className="relative mt-1">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                {...register("confirmPassword")}
                placeholder="Confirm your new password"
                className={errors.confirmPassword ? "border-red-500" : ""}
                data-testid="input-confirm-password"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                data-testid="button-toggle-confirm-password"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>
            )}
          </div>

          {/* Password Requirements */}
          <div className="bg-info/10 p-3 rounded-lg">
            <p className="text-xs text-base-content/70 mb-2 font-medium">Password Requirements:</p>
            <ul className="text-xs text-base-content/60 space-y-1">
              <li className="flex items-center gap-2">
                <span className={newPassword && newPassword.length >= 6 ? "text-green-500" : "text-base-content/40"}>
                  {newPassword && newPassword.length >= 6 ? "✓" : "○"}
                </span>
                At least 6 characters long
              </li>
              <li className="flex items-center gap-2">
                <span className={newPassword && /[A-Z]/.test(newPassword) ? "text-green-500" : "text-base-content/40"}>
                  {newPassword && /[A-Z]/.test(newPassword) ? "✓" : "○"}
                </span>
                At least one uppercase letter (recommended)
              </li>
              <li className="flex items-center gap-2">
                <span className={newPassword && /[0-9]/.test(newPassword) ? "text-green-500" : "text-base-content/40"}>
                  {newPassword && /[0-9]/.test(newPassword) ? "✓" : "○"}
                </span>
                At least one number (recommended)
              </li>
            </ul>
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <Button
              type="submit"
              className="w-full"
              disabled={changePasswordMutation.isPending}
              data-testid="button-change-password"
            >
              {changePasswordMutation.isPending ? (
                <>
                  <span className="loading loading-spinner loading-sm mr-2"></span>
                  Changing Password...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Change Password
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Security Notice */}
        <div className="mt-6 pt-4 border-t border-base-300">
          <div className="flex items-start gap-2 text-xs text-base-content/60">
            <Shield className="w-3 h-3 mt-0.5 text-base-content/40" />
            <p>
              This is a mandatory security step. You cannot access the application until you change your temporary password.
            </p>
          </div>
        </div>
      </div>
      {/* Prevent backdrop click - modal cannot be dismissed */}
    </div>
  );
}