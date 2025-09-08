import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

interface Certificate {
  id: string;
  userId: string;
  courseId: string;
  organisationId: string;
  certificateUrl: string;
  issuedAt: string;
  expiryDate?: string;
  user?: {
    firstName: string;
    lastName: string;
    email: string;
  };
  course?: {
    title: string;
  };
}

export default function Certificates() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch certificates for the organization
  const { data: certificates, isLoading } = useQuery({
    queryKey: ['/api/certificates', user?.organisationId],
    enabled: !!user?.organisationId,
  });

  const filteredCertificates = (certificates as Certificate[] || []).filter((cert: Certificate) => {
    if (!searchQuery) return true;
    
    const searchLower = searchQuery.toLowerCase();
    const userName = `${cert.user?.firstName} ${cert.user?.lastName}`.toLowerCase();
    const userEmail = cert.user?.email?.toLowerCase() || '';
    const courseTitle = cert.course?.title?.toLowerCase() || '';
    
    return userName.includes(searchLower) || 
           userEmail.includes(searchLower) || 
           courseTitle.includes(searchLower);
  });

  const handleDownload = (certificate: Certificate) => {
    // Use the proper certificate download endpoint with authentication
    window.open(`/api/certificates/${certificate.id}/download`, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading loading-spinner loading-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            Certificates
          </h1>
          <p className="text-base-content/70">
            View and download all generated certificates for your organization
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="form-control flex-1">
              <div className="input-group">
                <span className="bg-base-200">
                  <i className="fas fa-search"></i>
                </span>
                <input
                  type="text"
                  placeholder="Search by user name, email, or course..."
                  className="input input-bordered flex-1"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-certificates"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Certificates List */}
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body p-0">
          {filteredCertificates.length === 0 ? (
            <div className="text-center py-12" data-testid="empty-state">
              <i className="fas fa-certificate text-6xl text-base-300 mb-4"></i>
              <h3 className="text-lg font-semibold mb-2">No certificates found</h3>
              <p className="text-base-content/70">
                {searchQuery ? "Try adjusting your search terms" : "Certificates will appear here once users complete courses"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-zebra">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Course</th>
                    <th>Issued Date</th>
                    <th>Expiry Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCertificates.map((certificate: Certificate) => (
                    <tr key={certificate.id}>
                      <td>
                        <div>
                          <div className="font-semibold" data-testid={`text-user-name-${certificate.id}`}>
                            {certificate.user?.firstName} {certificate.user?.lastName}
                          </div>
                          <div className="text-sm text-base-content/70" data-testid={`text-user-email-${certificate.id}`}>
                            {certificate.user?.email}
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="font-medium" data-testid={`text-course-title-${certificate.id}`}>
                          {certificate.course?.title}
                        </div>
                      </td>
                      <td>
                        <span data-testid={`text-issued-date-${certificate.id}`}>
                          {new Date(certificate.issuedAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td>
                        <span data-testid={`text-expiry-date-${certificate.id}`}>
                          {certificate.expiryDate 
                            ? new Date(certificate.expiryDate).toLocaleDateString()
                            : 'Never'
                          }
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => handleDownload(certificate)}
                          data-testid={`button-download-${certificate.id}`}
                        >
                          <i className="fas fa-download"></i>
                          Download
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      {filteredCertificates.length > 0 && (
        <div className="stats stats-horizontal shadow-sm">
          <div className="stat">
            <div className="stat-title">Total Certificates</div>
            <div className="stat-value text-primary" data-testid="stat-total-certificates">
              {filteredCertificates.length}
            </div>
          </div>
          <div className="stat">
            <div className="stat-title">This Month</div>
            <div className="stat-value text-secondary" data-testid="stat-monthly-certificates">
              {filteredCertificates.filter((cert: Certificate) => {
                const certDate = new Date(cert.issuedAt);
                const now = new Date();
                return certDate.getMonth() === now.getMonth() && 
                       certDate.getFullYear() === now.getFullYear();
              }).length}
            </div>
          </div>
          <div className="stat">
            <div className="stat-title">Expiring Soon</div>
            <div className="stat-value text-warning" data-testid="stat-expiring-certificates">
              {filteredCertificates.filter((cert: Certificate) => {
                if (!cert.expiryDate) return false;
                const expiryDate = new Date(cert.expiryDate);
                const thirtyDaysFromNow = new Date();
                thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
                return expiryDate <= thirtyDaysFromNow && expiryDate >= new Date();
              }).length}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}