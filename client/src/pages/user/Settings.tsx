import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Certificate {
  id: string;
  courseTitle: string;
  score: number;
  issuedAt: string;
  certificateUrl: string;
  expiryDate?: string;
}

export function UserSettings() {
  const [activeTab, setActiveTab] = useState(0);
  const [showAccessDeniedModal, setShowAccessDeniedModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();


  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [notificationData, setNotificationData] = useState({
    assignmentEmails: true,
    reminderEmails: true,
    completionEmails: true,
  });

  const { data: certificates = [], isLoading: certificatesLoading } = useQuery<Certificate[]>({
    queryKey: ['/api/user/certificates'],
    enabled: user?.allowCertificateDownload === true,
  });

  // Fetch organization data for the access denied message
  const { data: organisation } = useQuery<{ displayName: string }>({
    queryKey: ['/api/organisations', user?.organisationId],
    enabled: !!user?.organisationId,
  });


  const changePasswordMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/auth/change-password', data);
    },
    onSuccess: () => {
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      toast({
        title: "Success",
        description: "Password changed successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to change password",
        variant: "destructive",
      });
    },
  });


  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Please fill in all password fields",
        variant: "destructive",
      });
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Validation Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }
    changePasswordMutation.mutate({
      currentPassword: passwordData.currentPassword,
      newPassword: passwordData.newPassword,
    });
  };

  const downloadCertificate = (certificate: Certificate) => {
    if (!user?.allowCertificateDownload) {
      setShowAccessDeniedModal(true);
      return;
    }
    // Create a temporary link to download the certificate
    const link = document.createElement('a');
    link.href = certificate.certificateUrl;
    link.download = `Certificate-${certificate.courseTitle.replace(/\s+/g, '-')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tabs = ["Password", "Notifications"];
  
  // Only show certificates tab if user has permission
  if (user?.allowCertificateDownload) {
    tabs.push("Certificates");
  }

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li className="font-semibold" data-testid="text-current-page">Settings</li>
        </ul>
      </div>

      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">User Settings</h1>
      </div>

      <div className="card bg-base-200 shadow-sm">
        <div className="card-body">
          {/* Tabs */}
          <div className="tabs tabs-bordered mb-6">
            {tabs.map((tab, index) => (
              <a 
                key={index}
                className={`tab ${activeTab === index ? 'tab-active' : ''}`}
                onClick={() => setActiveTab(index)}
                data-testid={`tab-${index}`}
              >
                {tab}
              </a>
            ))}
          </div>


          {/* Password Tab */}
          {activeTab === 0 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Change Password</h3>
              
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Current Password *</span>
                  </label>
                  <input 
                    type="password" 
                    className="input input-bordered" 
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    required 
                    data-testid="input-current-password"
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">New Password *</span>
                  </label>
                  <input 
                    type="password" 
                    className="input input-bordered" 
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                    required 
                    data-testid="input-new-password"
                  />
                </div>

                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Confirm New Password *</span>
                  </label>
                  <input 
                    type="password" 
                    className="input input-bordered" 
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    required 
                    data-testid="input-confirm-password"
                  />
                </div>

                <div className="alert alert-info">
                  <i className="fas fa-info-circle"></i>
                  <div>
                    <div className="font-bold">Password Requirements</div>
                    <div className="text-sm">
                      Your password must be at least 8 characters long and contain uppercase, lowercase, numbers, and special characters.
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={changePasswordMutation.isPending}
                    data-testid="button-change-password"
                  >
                    {changePasswordMutation.isPending ? (
                      <span className="loading loading-spinner loading-sm"></span>
                    ) : (
                      'Change Password'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 1 && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Notification Preferences</h3>
              
              <div className="space-y-4">
                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className="toggle" 
                      checked={notificationData.assignmentEmails}
                      onChange={(e) => setNotificationData(prev => ({ ...prev, assignmentEmails: e.target.checked }))}
                      data-testid="toggle-assignment-emails"
                      style={{
                        '--tglbg': notificationData.assignmentEmails ? '#4ade80' : '#d1d5db',
                        backgroundColor: notificationData.assignmentEmails ? '#4ade80' : '#d1d5db',
                      } as React.CSSProperties}
                    />
                    <span className="label-text">
                      <strong>Course Assignment Emails</strong>
                      <div className="text-sm text-base-content/60">Receive emails when new courses are assigned to you</div>
                    </span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className="toggle" 
                      checked={notificationData.reminderEmails}
                      onChange={(e) => setNotificationData(prev => ({ ...prev, reminderEmails: e.target.checked }))}
                      data-testid="toggle-reminder-emails"
                      style={{
                        '--tglbg': notificationData.reminderEmails ? '#4ade80' : '#d1d5db',
                        backgroundColor: notificationData.reminderEmails ? '#4ade80' : '#d1d5db',
                      } as React.CSSProperties}
                    />
                    <span className="label-text">
                      <strong>Reminder Emails</strong>
                      <div className="text-sm text-base-content/60">Receive reminder emails before course due dates</div>
                    </span>
                  </label>
                </div>

                <div className="form-control">
                  <label className="label cursor-pointer justify-start gap-3">
                    <input 
                      type="checkbox" 
                      className="toggle" 
                      checked={notificationData.completionEmails}
                      onChange={(e) => setNotificationData(prev => ({ ...prev, completionEmails: e.target.checked }))}
                      data-testid="toggle-completion-emails"
                      style={{
                        '--tglbg': notificationData.completionEmails ? '#4ade80' : '#d1d5db',
                        backgroundColor: notificationData.completionEmails ? '#4ade80' : '#d1d5db',
                      } as React.CSSProperties}
                    />
                    <span className="label-text">
                      <strong>Completion Confirmations</strong>
                      <div className="text-sm text-base-content/60">Receive emails when you complete courses</div>
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <button 
                  className="btn btn-primary"
                  data-testid="button-save-notifications"
                >
                  Save Preferences
                </button>
              </div>
            </div>
          )}

          {/* Certificates Tab */}
          {activeTab === 2 && user?.allowCertificateDownload && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">My Certificates</h3>
              
              {certificatesLoading ? (
                <div className="text-center">
                  <span className="loading loading-spinner loading-md"></span>
                </div>
              ) : certificates.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">📜</div>
                  <h4 className="text-xl font-bold mb-2">No certificates yet</h4>
                  <p className="text-base-content/60">Complete courses to earn certificates</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {certificates.map((certificate) => (
                    <div key={certificate.id} className="card bg-base-100 shadow-sm" data-testid={`card-certificate-${certificate.id}`}>
                      <div className="card-body">
                        <h4 className="card-title text-lg" data-testid={`text-cert-course-${certificate.id}`}>
                          {certificate.courseTitle}
                        </h4>
                        <div className="text-sm space-y-1">
                          <div data-testid={`text-cert-score-${certificate.id}`}>
                            <strong>Score:</strong> {certificate.score}%
                          </div>
                          <div data-testid={`text-cert-issued-${certificate.id}`}>
                            <strong>Issued:</strong> {new Date(certificate.issuedAt).toLocaleDateString()}
                          </div>
                          {certificate.expiryDate && (
                            <div data-testid={`text-cert-expires-${certificate.id}`}>
                              <strong>Expires:</strong> {new Date(certificate.expiryDate).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                        <div className="card-actions justify-end mt-4">
                          <button 
                            className="btn btn-sm btn-outline"
                            data-testid={`button-view-cert-${certificate.id}`}
                          >
                            <i className="fas fa-eye"></i> View
                          </button>
                          <button 
                            className="btn btn-sm btn-primary"
                            onClick={() => downloadCertificate(certificate)}
                            data-testid={`button-download-cert-${certificate.id}`}
                          >
                            <i className="fas fa-download"></i> Download
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Certificate Access Denied Modal */}
      {showAccessDeniedModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4 text-center">
              <i className="fas fa-lock text-warning text-2xl mb-2"></i>
              <br />
              Certificate Access Restricted
            </h3>
            
            <div className="text-center space-y-4">
              <p className="text-base-content/80">
                I'm sorry, <strong>{organisation?.displayName || 'your organization'}</strong> has not allowed you access to your certificates.
              </p>
              <p className="text-base-content/80">
                Get in touch with them to gain access.
              </p>
            </div>

            <div className="modal-action justify-center">
              <button 
                className="btn btn-primary"
                onClick={() => setShowAccessDeniedModal(false)}
                data-testid="button-close-access-denied"
              >
                Understood
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowAccessDeniedModal(false)}></div>
        </div>
      )}
    </div>
  );
}
