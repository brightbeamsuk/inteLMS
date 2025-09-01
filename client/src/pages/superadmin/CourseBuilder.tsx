import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ObjectUploader } from "@/components/ObjectUploader";
import { ImageUpload } from "@/components/ImageUpload";
import type { UploadResult } from "@uppy/core";

interface ScormValidation {
  packageId: string;
  manifestFound: boolean;
  launchFileFound: boolean;
  launchFileCanOpen: boolean;
  launchFilePath: string;
  errors: string[];
  status: 'valid' | 'draft' | 'error';
}

interface ScormPackageInfo {
  packageId: string;
  title: string;
  description?: string;
  version: string;
  launchFilePath: string;
  rootPath: string;
  validation: ScormValidation;
}

export function SuperAdminCourseBuilder() {
  const [activeTab, setActiveTab] = useState(0);
  const [showScormPreview, setShowScormPreview] = useState(false);
  const [scormPackageInfo, setScormPackageInfo] = useState<ScormPackageInfo | null>(null);
  const [isProcessingScorm, setIsProcessingScorm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    estimatedDuration: 60,
    passmark: 80,
    category: "",
    tags: "",
    coverImageUrl: "",
    scormPackageUrl: "",
    certificateExpiryPeriod: 12,
    neverExpires: false,
  });

  const createCourseMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest('POST', '/api/courses', {
        ...data,
        status: 'published',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/courses'] });
      toast({
        title: "Success",
        description: "Course published to library successfully",
      });
      resetForm();
      setActiveTab(0);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to publish course",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      estimatedDuration: 60,
      passmark: 80,
      category: "",
      tags: "",
      coverImageUrl: "",
      scormPackageUrl: "",
      certificateExpiryPeriod: 12,
      neverExpires: false,
    });
    setScormPackageInfo(null);
    setIsProcessingScorm(false);
  };

  const handleScormUpload = async () => {
    try {
      const response = await apiRequest('POST', '/api/objects/upload', {});
      const data = await response.json();
      return {
        method: 'PUT' as const,
        url: data.uploadURL,
      };
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get upload URL",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleScormComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const uploadUrl = result.successful[0].uploadURL as string;
      setFormData(prev => ({ ...prev, scormPackageUrl: uploadUrl }));
      
      // Process the uploaded package with new preview system
      setIsProcessingScorm(true);
      try {
        const response = await apiRequest('POST', '/api/scorm/process-upload', {
          packageUrl: uploadUrl
        });
        
        const data = await response.json();
        const { packageInfo } = data;
        setScormPackageInfo(packageInfo);
        
        // Safely access validation status with fallback
        const validationStatus = packageInfo.validation?.status || 'unknown';
        
        toast({
          title: "SCORM Package Processed",
          description: `Package validated with status: ${validationStatus}`,
          variant: validationStatus === 'valid' ? 'default' : 'destructive'
        });
        
        // Auto-fill title if not already set and package has one
        if (!formData.title && packageInfo.title && packageInfo.title !== `SCORM Package ${packageInfo.packageId}`) {
          setFormData(prev => ({ ...prev, title: packageInfo.title }));
        }
        
      } catch (error) {
        console.error('Error processing SCORM package:', error);
        toast({
          title: "Processing Error",
          description: "Failed to process SCORM package. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsProcessingScorm(false);
      }
    }
  };


  const handleTestPackage = () => {
    if (!scormPackageInfo) {
      toast({
        title: "No SCORM Package",
        description: "Please upload a SCORM package first",
        variant: "destructive",
      });
      return;
    }
    
    // Open test page in new window
    const testUrl = `/scorm-preview/${scormPackageInfo.packageId}/test`;
    window.open(testUrl, '_blank', 'width=800,height=600,resizable=yes,scrollbars=yes');
  };

  const handlePreviewCourse = () => {
    if (!scormPackageInfo) {
      toast({
        title: "No SCORM Package",
        description: "Please upload a SCORM package first",
        variant: "destructive",
      });
      return;
    }
    
    if (scormPackageInfo.validation.status === 'error') {
      toast({
        title: "Package Error",
        description: "Cannot preview package with errors. Please upload a valid SCORM package.",
        variant: "destructive",
      });
      return;
    }
    
    // Use the direct launch URL provided by the enhanced SCORM service
    if (scormPackageInfo.launchUrl) {
      window.open(scormPackageInfo.launchUrl, '_blank', 'width=1200,height=800,resizable=yes,scrollbars=yes');
    } else {
      toast({
        title: "Preview Error",
        description: "No launch URL available for this SCORM package",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.scormPackageUrl) {
      toast({
        title: "Validation Error",
        description: "Please provide a title and upload a SCORM package",
        variant: "destructive",
      });
      return;
    }

    if (!scormPackageInfo) {
      toast({
        title: "SCORM Package Processing",
        description: "Please wait for SCORM package processing to complete",
        variant: "destructive",
      });
      return;
    }

    if (scormPackageInfo.validation.status === 'error') {
      toast({
        title: "Invalid SCORM Package",
        description: "Cannot publish course with SCORM package errors. Please upload a valid package.",
        variant: "destructive",
      });
      return;
    }

    const courseData = {
      ...formData,
      certificateExpiryPeriod: formData.neverExpires ? null : formData.certificateExpiryPeriod,
    };

    createCourseMutation.mutate(courseData);
  };

  const tabs = ["Upload & Details", "Preview", "Publish"];

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li><a onClick={() => setLocation('/superadmin')} className="cursor-pointer" data-testid="link-superadmin">SuperAdmin</a></li>
          <li className="font-semibold" data-testid="text-current-page">Course Builder</li>
        </ul>
      </div>

      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Course Builder</h1>
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

          {/* Tab Content */}
          {activeTab === 0 && (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* SCORM Package Upload */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">SCORM Package Upload *</span>
                </label>
                <ObjectUploader
                  maxNumberOfFiles={1}
                  maxFileSize={104857600} // 100MB
                  onGetUploadParameters={handleScormUpload}
                  onComplete={handleScormComplete}
                  buttonClassName="btn btn-outline w-full"
                >
                  <i className="fas fa-upload mr-2"></i>
                  {isProcessingScorm ? "Processing..." : formData.scormPackageUrl ? "Change SCORM Package" : "Upload SCORM Package (.zip)"}
                </ObjectUploader>
                
                {/* SCORM Package Status and Actions */}
                {formData.scormPackageUrl && (
                  <div className="mt-4 p-4 bg-base-100 rounded-lg border">
                    {isProcessingScorm ? (
                      <div className="flex items-center gap-2">
                        <span className="loading loading-spinner loading-sm"></span>
                        <span>Processing SCORM package...</span>
                      </div>
                    ) : scormPackageInfo ? (
                      <div className="space-y-3">
                        {/* Package Info */}
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold" data-testid="text-package-title">{scormPackageInfo.title}</h4>
                            <p className="text-sm text-base-content/60">Package ID: {scormPackageInfo.packageId}</p>
                          </div>
                          <div className={`badge ${
                            scormPackageInfo.validation?.status === 'valid' ? 'badge-success' : 
                            scormPackageInfo.validation?.status === 'draft' ? 'badge-warning' : 'badge-error'
                          }`} data-testid="badge-validation-status">
                            {(scormPackageInfo.validation?.status || 'unknown').toUpperCase()}
                          </div>
                        </div>
                        
                        {/* Validation Details */}
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2">
                            <i className={`fas ${scormPackageInfo.validation?.manifestFound ? 'fa-check text-success' : 'fa-times text-error'}`}></i>
                            <span>Manifest Found</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <i className={`fas ${scormPackageInfo.validation?.launchFileFound ? 'fa-check text-success' : 'fa-times text-error'}`}></i>
                            <span>Launch File Found</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <i className={`fas ${scormPackageInfo.validation?.launchFileCanOpen ? 'fa-check text-success' : 'fa-times text-error'}`}></i>
                            <span>Launch File Accessible</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <i className="fas fa-info-circle text-info"></i>
                            <span>SCORM {scormPackageInfo.version}</span>
                          </div>
                        </div>
                        
                        {/* Error Messages */}
                        {scormPackageInfo.validation?.errors && scormPackageInfo.validation.errors.length > 0 && (
                          <div className="alert alert-error text-sm">
                            <i className="fas fa-exclamation-triangle"></i>
                            <div>
                              <p className="font-semibold">Validation Errors:</p>
                              <ul className="list-disc list-inside">
                                {scormPackageInfo.validation.errors.map((error, index) => (
                                  <li key={index}>{error}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
                        
                        {/* Action Buttons */}
                        <div className="flex gap-2 justify-end">
                          <button 
                            type="button"
                            className="btn btn-sm btn-outline"
                            onClick={handleTestPackage}
                            data-testid="button-test-package"
                          >
                            <i className="fas fa-vial"></i> Test Package
                          </button>
                          <button 
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={handlePreviewCourse}
                            disabled={scormPackageInfo.validation?.status === 'error'}
                            data-testid="button-preview-package"
                          >
                            <i className="fas fa-eye"></i> Preview Course
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-success">
                        <i className="fas fa-check"></i> SCORM package uploaded (processing...)
                      </div>
                    )}
                  </div>
                )}
                
                <label className="label">
                  <span className="label-text-alt">Upload a SCORM 1.2 or SCORM 2004 compliant package (.zip)</span>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Course Title *</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="Enter course title" 
                    className="input input-bordered" 
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    required 
                    data-testid="input-course-title"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Estimated Duration (minutes) *</span>
                  </label>
                  <input 
                    type="number" 
                    placeholder="60" 
                    className="input input-bordered" 
                    value={formData.estimatedDuration}
                    onChange={(e) => setFormData(prev => ({ ...prev, estimatedDuration: parseInt(e.target.value) || 0 }))}
                    required 
                    data-testid="input-course-duration"
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Short Description *</span>
                </label>
                <textarea 
                  className="textarea textarea-bordered" 
                  placeholder="Brief description of the course content and objectives"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  required
                  data-testid="input-course-description"
                ></textarea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Pass Mark (%) *</span>
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    max="100" 
                    value={formData.passmark} 
                    className="input input-bordered" 
                    onChange={(e) => setFormData(prev => ({ ...prev, passmark: parseInt(e.target.value) || 80 }))}
                    required 
                    data-testid="input-course-passmark"
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Category</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Compliance, Safety, IT" 
                    className="input input-bordered" 
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    data-testid="input-course-category"
                  />
                </div>
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Tags</span>
                </label>
                <input 
                  type="text" 
                  placeholder="Compliance, Safety, IT (comma-separated)" 
                  className="input input-bordered" 
                  value={formData.tags}
                  onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                  data-testid="input-course-tags"
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Cover Image (Optional)</span>
                </label>
                <ImageUpload
                  imageType="course-cover"
                  currentImageUrl={formData.coverImageUrl}
                  onImageUploaded={(publicPath) => setFormData(prev => ({ ...prev, coverImageUrl: publicPath }))}
                  buttonClassName="btn btn-outline w-full"
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Certificate Expiry Period</span>
                </label>
                <div className="flex gap-2 items-center">
                  <input 
                    type="number" 
                    placeholder="12" 
                    className="input input-bordered flex-1" 
                    value={formData.certificateExpiryPeriod}
                    onChange={(e) => setFormData(prev => ({ ...prev, certificateExpiryPeriod: parseInt(e.target.value) || 12 }))}
                    disabled={formData.neverExpires}
                    data-testid="input-expiry-period"
                  />
                  <select 
                    className="select select-bordered"
                    disabled={formData.neverExpires}
                    data-testid="select-expiry-unit"
                  >
                    <option value="months">Months</option>
                    <option value="years">Years</option>
                  </select>
                  <label className="label cursor-pointer gap-2">
                    <input 
                      type="checkbox" 
                      className="checkbox" 
                      checked={formData.neverExpires}
                      onChange={(e) => setFormData(prev => ({ ...prev, neverExpires: e.target.checked }))}
                      data-testid="checkbox-never-expires"
                    />
                    <span className="label-text">Never expires</span>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setActiveTab(1)}
                  disabled={!formData.scormPackageUrl}
                  data-testid="button-preview-course"
                >
                  Preview
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={createCourseMutation.isPending}
                  data-testid="button-publish-course"
                >
                  {createCourseMutation.isPending ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : (
                    'Publish to Library'
                  )}
                </button>
              </div>
            </form>
          )}

          {activeTab === 1 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold">Course Preview</h3>
              <div className="alert alert-info">
                <i className="fas fa-info-circle"></i>
                <span>Preview functionality would launch the SCORM package in a test environment</span>
              </div>
              <div className="bg-base-300 rounded-lg h-96 flex items-center justify-center">
                <div className="text-center">
                  <div className="text-4xl mb-4">📚</div>
                  <h4 className="text-2xl font-bold mb-2" data-testid="text-preview-title">SCORM Preview Player</h4>
                  <p className="text-base-content/60 mb-4">Course preview would load here</p>
                  <button 
                    className="btn btn-primary" 
                    onClick={handlePreviewCourse}
                    disabled={!formData.scormPackageUrl}
                    data-testid="button-test-course"
                  >
                    <i className="fas fa-play"></i> Test Course
                  </button>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button 
                  className="btn btn-ghost"
                  onClick={() => setActiveTab(0)}
                  data-testid="button-back-to-details"
                >
                  Back to Details
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={() => setActiveTab(2)}
                  data-testid="button-continue-to-publish"
                >
                  Continue to Publish
                </button>
              </div>
            </div>
          )}

          {activeTab === 2 && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold">Publish Course</h3>
              
              <div className="card bg-base-100">
                <div className="card-body">
                  <h4 className="card-title">Course Summary</h4>
                  <div className="space-y-2">
                    <div><strong>Title:</strong> <span data-testid="text-summary-title">{formData.title || 'Untitled Course'}</span></div>
                    <div><strong>Duration:</strong> <span data-testid="text-summary-duration">{formData.estimatedDuration} minutes</span></div>
                    <div><strong>Pass Mark:</strong> <span data-testid="text-summary-passmark">{formData.passmark}%</span></div>
                    <div><strong>Category:</strong> <span data-testid="text-summary-category">{formData.category || 'Uncategorised'}</span></div>
                    <div><strong>SCORM Package:</strong> <span className={formData.scormPackageUrl ? 'text-success' : 'text-error'} data-testid="text-summary-scorm">
                      {formData.scormPackageUrl ? 'Uploaded ✓' : 'Not uploaded ✗'}
                    </span></div>
                  </div>
                </div>
              </div>

              <div className="alert alert-warning">
                <i className="fas fa-exclamation-triangle"></i>
                <span>Once published, this course will be available in the global library for all organisations to assign.</span>
              </div>

              <div className="flex gap-2 justify-end">
                <button 
                  className="btn btn-ghost"
                  onClick={() => setActiveTab(1)}
                  data-testid="button-back-to-preview"
                >
                  Back to Preview
                </button>
                <button 
                  className="btn btn-primary"
                  onClick={handleSubmit}
                  disabled={createCourseMutation.isPending || !formData.scormPackageUrl}
                  data-testid="button-final-publish"
                >
                  {createCourseMutation.isPending ? (
                    <span className="loading loading-spinner loading-sm"></span>
                  ) : (
                    'Publish to Global Library'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SCORM Preview Modal */}
      {showScormPreview && (
        <dialog className="modal modal-open">
          <div className="modal-box w-11/12 max-w-7xl h-5/6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">SCORM Course Preview - {formData.title || 'Untitled Course'}</h3>
              <button 
                className="btn btn-sm btn-circle btn-ghost"
                onClick={() => setShowScormPreview(false)}
                data-testid="button-close-preview"
              >
                ✕
              </button>
            </div>
            
            <div className="w-full h-full bg-white rounded-lg overflow-hidden">
              {formData.scormPackageUrl ? (
                <iframe
                  src={`/api/scorm/preview?packageUrl=${encodeURIComponent(formData.scormPackageUrl)}`}
                  className="w-full h-full border-0"
                  title="SCORM Course Preview"
                  data-testid="iframe-scorm-preview"
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="text-4xl mb-4">⚠️</div>
                    <p className="text-lg">No SCORM package available for preview</p>
                  </div>
                </div>
              )}
            </div>
            
            <div className="modal-action">
              <button 
                className="btn btn-outline"
                onClick={() => setShowScormPreview(false)}
                data-testid="button-close-preview-modal"
              >
                Close Preview
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowScormPreview(false)}></div>
        </dialog>
      )}
    </div>
  );
}
