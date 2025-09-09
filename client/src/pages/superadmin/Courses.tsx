import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ImageUpload } from "@/components/ImageUpload";

interface Course {
  id: string;
  title: string;
  description: string;
  folderId?: string;
  scormPackageUrl?: string;
  coverImageUrl?: string;
  estimatedDuration: number;
  passmark: number;
  category: string;
  tags: string;
  certificateExpiryPeriod?: number;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface CourseFolder {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  sortOrder: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface CourseAnalytics {
  courseId: string;
  totalAssignments: number;
  totalCompletions: number;
  successfulCompletions: number;
  averageScore: number;
  completionRate: number;
  organizationsUsing: number;
  averageTimeToComplete: number;
}

export function SuperAdminCourses() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedFolder, setSelectedFolder] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Course>>({});
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [selectedFolderForEdit, setSelectedFolderForEdit] = useState<CourseFolder | null>(null);
  const [folderFormData, setFolderFormData] = useState<Partial<CourseFolder>>({});
  const [showFolderDeleteModal, setShowFolderDeleteModal] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: courses = [], isLoading } = useQuery<Course[]>({
    queryKey: ['/api/courses'],
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<CourseAnalytics>({
    queryKey: [`/api/courses/${selectedCourse?.id}/analytics`],
    enabled: !!selectedCourse && showAnalyticsModal,
  });

  const { data: folders = [], isLoading: foldersLoading } = useQuery<CourseFolder[]>({
    queryKey: ['/api/course-folders'],
  });

  const updateCourseMutation = useMutation({
    mutationFn: async (data: Partial<Course>) => {
      if (!selectedCourse) throw new Error('No course selected');
      return await apiRequest('PUT', `/api/courses/${selectedCourse.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/courses'] });
      setIsEditing(false);
      toast({
        title: "Success",
        description: "Course updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update course",
        variant: "destructive",
      });
    },
  });

  const archiveCourseMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCourse) throw new Error('No course selected');
      return await apiRequest('PUT', `/api/courses/${selectedCourse.id}`, { status: 'archived' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/courses'] });
      setShowArchiveModal(false);
      setShowDetailsModal(false);
      setConfirmText("");
      toast({
        title: "Course Archived",
        description: "Course has been archived successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to archive course",
        variant: "destructive",
      });
    },
  });

  const restoreCourseMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCourse) throw new Error('No course selected');
      return await apiRequest('PUT', `/api/courses/${selectedCourse.id}`, { status: 'published' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/courses'] });
      setShowDetailsModal(false);
      toast({
        title: "Course Restored",
        description: "Course has been restored successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to restore course",
        variant: "destructive",
      });
    },
  });

  const deleteCourseMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCourse) throw new Error('No course selected');
      return await apiRequest('DELETE', `/api/courses/${selectedCourse.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/courses'] });
      setShowDeleteModal(false);
      setShowDetailsModal(false);
      setConfirmText("");
      toast({
        title: "Course Deleted",
        description: "Course has been permanently deleted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete course",
        variant: "destructive",
      });
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (data: Partial<CourseFolder>) => {
      return await apiRequest('POST', '/api/course-folders', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/course-folders'] });
      setShowFolderModal(false);
      setFolderFormData({});
      toast({
        title: "Success",
        description: "Course folder created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create folder",
        variant: "destructive",
      });
    },
  });

  const updateFolderMutation = useMutation({
    mutationFn: async (data: Partial<CourseFolder>) => {
      if (!selectedFolderForEdit) throw new Error('No folder selected');
      return await apiRequest('PUT', `/api/course-folders/${selectedFolderForEdit.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/course-folders'] });
      setShowFolderModal(false);
      setSelectedFolderForEdit(null);
      setFolderFormData({});
      toast({
        title: "Success",
        description: "Course folder updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update folder",
        variant: "destructive",
      });
    },
  });

  const deleteFolderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFolderForEdit) throw new Error('No folder selected');
      return await apiRequest('DELETE', `/api/course-folders/${selectedFolderForEdit.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/course-folders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/courses'] });
      setShowFolderDeleteModal(false);
      setSelectedFolderForEdit(null);
      toast({
        title: "Success",
        description: "Course folder deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete folder",
        variant: "destructive",
      });
    },
  });

  const handleEditCourse = () => {
    if (selectedCourse) {
      setEditFormData({
        title: selectedCourse.title,
        description: selectedCourse.description,
        estimatedDuration: selectedCourse.estimatedDuration,
        passmark: selectedCourse.passmark,
        category: selectedCourse.category,
        tags: selectedCourse.tags,
        certificateExpiryPeriod: selectedCourse.certificateExpiryPeriod,
        scormPackageUrl: selectedCourse.scormPackageUrl,
        coverImageUrl: selectedCourse.coverImageUrl,
      });
      setIsEditing(true);
    }
  };

  const handleSaveChanges = () => {
    updateCourseMutation.mutate(editFormData);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditFormData({});
  };

  const handlePreviewCourse = () => {
    if (selectedCourse?.scormPackageUrl) {
      // Open SCORM package in new window for preview
      window.open(selectedCourse.scormPackageUrl, '_blank');
    } else {
      toast({
        title: "No Preview Available",
        description: "This course doesn't have a SCORM package uploaded",
        variant: "destructive",
      });
    }
  };

  // Folder management handlers
  const handleCreateFolder = () => {
    setSelectedFolderForEdit(null);
    setFolderFormData({
      name: '',
      description: '',
      color: '#3b82f6',
      icon: 'fas fa-folder',
      sortOrder: folders.length,
    });
    setShowFolderModal(true);
  };

  const handleEditFolder = (folder: CourseFolder) => {
    setSelectedFolderForEdit(folder);
    setFolderFormData({
      name: folder.name,
      description: folder.description,
      color: folder.color,
      icon: folder.icon,
      sortOrder: folder.sortOrder,
    });
    setShowFolderModal(true);
  };

  const handleSaveFolder = () => {
    if (selectedFolderForEdit) {
      updateFolderMutation.mutate(folderFormData);
    } else {
      createFolderMutation.mutate(folderFormData);
    }
  };

  const handleDeleteFolder = (folder: CourseFolder) => {
    setSelectedFolderForEdit(folder);
    setShowFolderDeleteModal(true);
  };

  const confirmDeleteFolder = () => {
    deleteFolderMutation.mutate();
  };

  // Filter courses based on search, category, folder, and view mode
  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || course.category === selectedCategory;
    const matchesFolder = !selectedFolder || course.folderId === selectedFolder;
    const matchesViewMode = viewMode === 'active' ? course.status !== 'archived' : course.status === 'archived';
    return matchesSearch && matchesCategory && matchesFolder && matchesViewMode;
  });

  // Get unique categories
  const categories = Array.from(new Set(courses.map(course => course.category).filter(Boolean)));

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li><a onClick={() => setLocation('/superadmin')} className="cursor-pointer" data-testid="link-superadmin">SuperAdmin</a></li>
          <li className="font-semibold" data-testid="text-current-page">Courses</li>
        </ul>
      </div>

      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Global Course Library</h1>
          <div className="tabs tabs-boxed mt-2">
            <a 
              className={`tab ${viewMode === 'active' ? 'tab-active' : ''}`}
              onClick={() => setViewMode('active')}
              data-testid="tab-active-courses"
            >
              Active Courses
            </a>
            <a 
              className={`tab ${viewMode === 'archived' ? 'tab-active' : ''}`}
              onClick={() => setViewMode('archived')}
              data-testid="tab-archived-courses"
            >
              Archive
            </a>
          </div>
        </div>
        <Link href="/superadmin/course-builder">
          <button className="btn btn-primary" data-testid="button-add-new-course">
            <i className="fas fa-plus"></i> Add New Course
          </button>
        </Link>
      </div>

      {/* Filters */}
      <div className="card bg-base-200 shadow-sm mb-6">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="form-control flex-1">
              <input 
                type="text" 
                placeholder="Search courses by title or description..." 
                className="input input-bordered"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search-courses"
              />
            </div>
            <div className="form-control">
              <select 
                className="select select-bordered"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                data-testid="select-filter-category"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <select 
                className="select select-bordered"
                value={selectedFolder}
                onChange={(e) => setSelectedFolder(e.target.value)}
                data-testid="select-filter-folder"
              >
                <option value="">All Folders</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Folder Management Section */}
      <div className="card bg-base-100 shadow-sm mb-6">
        <div className="card-body">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold" data-testid="text-folder-management">Course Folders</h2>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={handleCreateFolder}
              data-testid="button-create-folder"
            >
              <i className="fas fa-plus"></i> New Folder
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {foldersLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="skeleton h-16 w-full"></div>
              ))
            ) : (
              folders.map((folder) => (
                <div 
                  key={folder.id} 
                  className="card bg-base-200 border-2 border-base-300 hover:border-primary/50 transition-colors cursor-pointer group"
                  data-testid={`folder-card-${folder.id}`}
                >
                  <div className="card-body p-3 text-center">
                    <div 
                      className="text-2xl mb-1"
                      style={{ color: folder.color }}
                    >
                      <i className={folder.icon}></i>
                    </div>
                    <div className="text-xs font-medium truncate" title={folder.name}>
                      {folder.name}
                    </div>
                    <div className="text-xs text-base-content/60">
                      {courses.filter(c => c.folderId === folder.id).length} courses
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity mt-2">
                      <div className="flex justify-center gap-1">
                        <button
                          className="btn btn-xs btn-ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditFolder(folder);
                          }}
                          data-testid={`button-edit-folder-${folder.id}`}
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                        <button
                          className="btn btn-xs btn-ghost text-error"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFolder(folder);
                          }}
                          data-testid={`button-delete-folder-${folder.id}`}
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Course Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="card bg-base-200 shadow-sm">
              <div className="card-body">
                <div className="skeleton h-4 w-full mb-2"></div>
                <div className="skeleton h-3 w-3/4 mb-4"></div>
                <div className="skeleton h-12 w-full"></div>
              </div>
            </div>
          ))
        ) : filteredCourses.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="text-6xl mb-4">{viewMode === 'archived' ? '📦' : '📚'}</div>
            <h3 className="text-2xl font-bold mb-2">
              {viewMode === 'archived' ? 'No archived courses' : 'No courses found'}
            </h3>
            <p className="text-base-content/60 mb-4">
              {viewMode === 'archived' ? 
                "No courses have been archived yet" :
                (searchTerm || selectedCategory ? 
                  "No courses match your current filters" : 
                  "No courses have been published to the library yet"
                )
              }
            </p>
            {viewMode === 'active' && (
              <Link href="/superadmin/course-builder">
                <button className="btn btn-primary" data-testid="button-create-first-course">
                  <i className="fas fa-plus"></i> Create First Course
                </button>
              </Link>
            )}
          </div>
        ) : (
          filteredCourses.map((course) => (
            <div key={course.id} className="card bg-base-200 shadow-sm hover:shadow-md transition-shadow" data-testid={`card-course-${course.id}`}>
              <figure className="px-4 pt-4">
                <div className="w-full h-32 bg-base-300 rounded-lg flex items-center justify-center">
                  {course.coverImageUrl ? (
                    <img 
                      src={course.coverImageUrl} 
                      alt={course.title} 
                      className="w-full h-full object-cover rounded-lg"
                      onError={(e) => {
                        // Show fallback icon on error
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  ) : null}
                  <i className={`fas fa-graduation-cap text-4xl text-base-content/40 ${course.coverImageUrl ? 'hidden' : ''}`}></i>
                </div>
              </figure>
              <div className="card-body">
                <h3 className="card-title text-lg" data-testid={`text-course-title-${course.id}`}>{course.title}</h3>
                <p className="text-sm text-base-content/60 line-clamp-2" data-testid={`text-course-description-${course.id}`}>
                  {course.description}
                </p>
                
                <div className="flex justify-between items-center mt-2">
                  <div className="text-sm">
                    <div data-testid={`text-course-duration-${course.id}`}>⏱️ {course.estimatedDuration} mins</div>
                    <div data-testid={`text-course-passmark-${course.id}`}>📊 {course.passmark}% pass</div>
                  </div>
                  <div className="flex flex-col items-end">
                    {course.category && (
                      <div className="badge badge-outline" data-testid={`badge-course-category-${course.id}`}>
                        {course.category}
                      </div>
                    )}
                  </div>
                </div>

                <div className="card-actions justify-end mt-4">
                  <button 
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setSelectedCourse(course);
                      setShowDetailsModal(true);
                      setIsEditing(false);
                    }}
                    data-testid={`button-course-details-${course.id}`}
                  >
                    <i className="fas fa-info-circle"></i> Details
                  </button>
                  {course.status !== 'archived' && (
                    <button 
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        setSelectedCourse(course);
                        setShowAnalyticsModal(true);
                      }}
                      data-testid={`button-course-analytics-${course.id}`}
                    >
                      <i className="fas fa-chart-bar"></i> Analytics
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Course Details Modal */}
      {showDetailsModal && selectedCourse && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-6xl">
            <h3 className="font-bold text-lg mb-4" data-testid="text-course-details-title">
              {isEditing ? 'Edit Course' : 'Course Details'}: {selectedCourse.title}
            </h3>
            
            {!isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Course Image</h4>
                    <div className="w-full h-48 bg-base-300 rounded-lg flex items-center justify-center">
                      {selectedCourse.coverImageUrl ? (
                        <img 
                          src={selectedCourse.coverImageUrl} 
                          alt={selectedCourse.title} 
                          className="w-full h-full object-cover rounded-lg" 
                          data-testid="img-course-cover"
                          onError={(e) => {
                            // Show fallback on error
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`text-center ${selectedCourse.coverImageUrl ? 'hidden' : ''}`}>
                        <i className="fas fa-graduation-cap text-6xl text-base-content/40 mb-2"></i>
                        <p className="text-sm text-base-content/60">No cover image</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Basic Information</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>Title:</strong> <span data-testid="text-details-title">{selectedCourse.title}</span></div>
                      <div><strong>Description:</strong> <span data-testid="text-details-description">{selectedCourse.description || 'No description'}</span></div>
                      <div><strong>Category:</strong> <span data-testid="text-details-category">{selectedCourse.category || 'Uncategorised'}</span></div>
                      <div><strong>Tags:</strong> <span data-testid="text-details-tags">{selectedCourse.tags || 'None'}</span></div>
                      <div><strong>Status:</strong> <span className={`badge ${selectedCourse.status === 'published' ? 'badge-success' : 'badge-warning'}`} data-testid="text-details-status">{selectedCourse.status}</span></div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Course Settings</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>Duration:</strong> <span data-testid="text-details-duration">{selectedCourse.estimatedDuration} minutes</span></div>
                      <div><strong>Pass Mark:</strong> <span data-testid="text-details-passmark">{selectedCourse.passmark}%</span></div>
                      <div><strong>Certificate Expiry:</strong> <span data-testid="text-details-certificate-expiry">
                        {selectedCourse.certificateExpiryPeriod ? `${selectedCourse.certificateExpiryPeriod} months` : 'Never expires'}
                      </span></div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Content & Media</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>SCORM Package:</strong> 
                        <span data-testid="text-details-scorm" className={selectedCourse.scormPackageUrl ? 'text-success' : 'text-error'}>
                          {selectedCourse.scormPackageUrl ? ' ✓ Uploaded' : ' ✗ Not uploaded'}
                        </span>
                      </div>
                      <div><strong>Cover Image:</strong> 
                        <span data-testid="text-details-cover" className={selectedCourse.coverImageUrl ? 'text-success' : 'text-error'}>
                          {selectedCourse.coverImageUrl ? ' ✓ Uploaded' : ' ✗ Not uploaded'}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Creation Info</h4>
                    <div className="space-y-2 text-sm">
                      <div><strong>Created By:</strong> <span data-testid="text-details-created-by">{selectedCourse.createdBy}</span></div>
                      <div><strong>Created:</strong> <span data-testid="text-details-created-at">{new Date(selectedCourse.createdAt).toLocaleDateString()}</span></div>
                      <div><strong>Last Updated:</strong> <span data-testid="text-details-updated-at">{new Date(selectedCourse.updatedAt).toLocaleDateString()}</span></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Course Title *</span>
                    </label>
                    <input 
                      type="text" 
                      className="input input-bordered" 
                      value={editFormData.title || ''}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, title: e.target.value }))}
                      data-testid="input-edit-title"
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Description</span>
                    </label>
                    <textarea 
                      className="textarea textarea-bordered h-24" 
                      value={editFormData.description || ''}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                      data-testid="input-edit-description"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Category</span>
                      </label>
                      <input 
                        type="text" 
                        className="input input-bordered" 
                        value={editFormData.category || ''}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, category: e.target.value }))}
                        data-testid="input-edit-category"
                      />
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Tags</span>
                      </label>
                      <input 
                        type="text" 
                        className="input input-bordered" 
                        placeholder="Comma separated"
                        value={editFormData.tags || ''}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, tags: e.target.value }))}
                        data-testid="input-edit-tags"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Duration (minutes) *</span>
                      </label>
                      <input 
                        type="number" 
                        min="1"
                        className="input input-bordered" 
                        value={editFormData.estimatedDuration || ''}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, estimatedDuration: parseInt(e.target.value) || 0 }))}
                        data-testid="input-edit-duration"
                      />
                    </div>

                    <div className="form-control">
                      <label className="label">
                        <span className="label-text">Pass Mark (%) *</span>
                      </label>
                      <input 
                        type="number" 
                        min="1" 
                        max="100"
                        className="input input-bordered" 
                        value={editFormData.passmark || ''}
                        onChange={(e) => setEditFormData(prev => ({ ...prev, passmark: parseInt(e.target.value) || 0 }))}
                        data-testid="input-edit-passmark"
                      />
                    </div>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Certificate Expiry Period (months)</span>
                    </label>
                    <input 
                      type="number" 
                      min="1"
                      className="input input-bordered" 
                      placeholder="Leave empty for never expires"
                      value={editFormData.certificateExpiryPeriod || ''}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, certificateExpiryPeriod: e.target.value ? parseInt(e.target.value) : undefined }))}
                      data-testid="input-edit-certificate-expiry"
                    />
                    <label className="label">
                      <span className="label-text-alt">Leave empty if certificates should never expire</span>
                    </label>
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">SCORM Package URL</span>
                    </label>
                    <input 
                      type="text" 
                      className="input input-bordered" 
                      value={editFormData.scormPackageUrl || ''}
                      onChange={(e) => setEditFormData(prev => ({ ...prev, scormPackageUrl: e.target.value }))}
                      data-testid="input-edit-scorm-url"
                    />
                  </div>

                  <div className="form-control">
                    <label className="label">
                      <span className="label-text">Cover Image</span>
                    </label>
                    <ImageUpload
                      imageType="course-cover"
                      currentImageUrl={editFormData.coverImageUrl}
                      onImageUploaded={(publicPath) => setEditFormData(prev => ({ ...prev, coverImageUrl: publicPath }))}
                      buttonClassName="btn btn-outline w-full"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 mt-6">
              {!isEditing ? (
                <>
                  {selectedCourse?.status !== 'archived' && (
                    <>
                      <button 
                        className="btn btn-sm btn-outline" 
                        onClick={handlePreviewCourse}
                        data-testid="button-preview-course-details"
                      >
                        <i className="fas fa-play"></i> Preview
                      </button>
                      <button 
                        className="btn btn-sm btn-secondary" 
                        onClick={handleEditCourse}
                        data-testid="button-edit-course-details"
                      >
                        <i className="fas fa-edit"></i> Edit Course
                      </button>
                      <button 
                        className="btn btn-sm btn-warning" 
                        onClick={() => setShowArchiveModal(true)}
                        data-testid="button-archive-course"
                      >
                        <i className="fas fa-archive"></i> Archive
                      </button>
                    </>
                  )}
                  {selectedCourse?.status === 'archived' && (
                    <>
                      <button 
                        className="btn btn-sm btn-success" 
                        onClick={() => restoreCourseMutation.mutate()}
                        disabled={restoreCourseMutation.isPending}
                        data-testid="button-restore-course"
                      >
                        {restoreCourseMutation.isPending ? (
                          <span className="loading loading-spinner loading-sm"></span>
                        ) : (
                          <i className="fas fa-undo"></i>
                        )}
                        Restore
                      </button>
                      <button 
                        className="btn btn-sm btn-error" 
                        onClick={() => setShowDeleteModal(true)}
                        data-testid="button-delete-course"
                      >
                        <i className="fas fa-trash"></i> Delete Permanently
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  <button 
                    className="btn btn-sm btn-success" 
                    onClick={handleSaveChanges}
                    disabled={updateCourseMutation.isPending}
                    data-testid="button-save-course-changes"
                  >
                    {updateCourseMutation.isPending ? (
                      <span className="loading loading-spinner loading-sm"></span>
                    ) : (
                      <i className="fas fa-save"></i>
                    )}
                    Save Changes
                  </button>
                  <button 
                    className="btn btn-sm btn-outline" 
                    onClick={handleCancelEdit}
                    data-testid="button-cancel-course-edit"
                  >
                    <i className="fas fa-times"></i> Cancel
                  </button>
                </>
              )}
            </div>

            <div className="modal-action">
              <button 
                className="btn"
                onClick={() => {
                  setShowDetailsModal(false);
                  setIsEditing(false);
                  setEditFormData({});
                }}
                data-testid="button-close-course-details"
              >
                Close
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => {
              setShowDetailsModal(false);
              setIsEditing(false);
              setEditFormData({});
            }}>close</button>
          </form>
        </dialog>
      )}

      {/* Course Analytics Modal */}
      {showAnalyticsModal && selectedCourse && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4" data-testid="text-course-analytics-title">
              Analytics: {selectedCourse.title}
            </h3>
            
            {analyticsLoading ? (
              <div className="flex justify-center items-center py-8">
                <span className="loading loading-spinner loading-lg"></span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="stat bg-base-100 shadow rounded-lg">
                  <div className="stat-figure text-primary">
                    <i className="fas fa-users text-2xl"></i>
                  </div>
                  <div className="stat-title">Organizations Using</div>
                  <div className="stat-value text-primary text-lg" data-testid="stat-organizations-using">
                    {analytics?.organizationsUsing || 0}
                  </div>
                  <div className="stat-desc">Active deployments</div>
                </div>

                <div className="stat bg-base-100 shadow rounded-lg">
                  <div className="stat-figure text-secondary">
                    <i className="fas fa-clipboard-list text-2xl"></i>
                  </div>
                  <div className="stat-title">Total Assignments</div>
                  <div className="stat-value text-secondary text-lg" data-testid="stat-total-assignments">
                    {analytics?.totalAssignments || 0}
                  </div>
                  <div className="stat-desc">Course deployments</div>
                </div>

                <div className="stat bg-base-100 shadow rounded-lg">
                  <div className="stat-figure text-accent">
                    <i className="fas fa-check-circle text-2xl"></i>
                  </div>
                  <div className="stat-title">Total Completions</div>
                  <div className="stat-value text-accent text-lg" data-testid="stat-total-completions">
                    {analytics?.totalCompletions || 0}
                  </div>
                  <div className="stat-desc">
                    {analytics?.successfulCompletions || 0} successful
                  </div>
                </div>

                <div className="stat bg-base-100 shadow rounded-lg">
                  <div className="stat-figure text-success">
                    <i className="fas fa-percentage text-2xl"></i>
                  </div>
                  <div className="stat-title">Completion Rate</div>
                  <div className="stat-value text-success text-lg" data-testid="stat-completion-rate">
                    {analytics?.completionRate ? `${analytics.completionRate.toFixed(1)}%` : '0%'}
                  </div>
                  <div className="stat-desc">Overall success</div>
                </div>

                <div className="stat bg-base-100 shadow rounded-lg col-span-1 md:col-span-2">
                  <div className="stat-figure text-info">
                    <i className="fas fa-trophy text-2xl"></i>
                  </div>
                  <div className="stat-title">Average Score</div>
                  <div className="stat-value text-info text-lg" data-testid="stat-average-score">
                    {analytics?.averageScore ? `${analytics.averageScore.toFixed(1)}%` : 'N/A'}
                  </div>
                  <div className="stat-desc">Across all completions</div>
                </div>

                <div className="stat bg-base-100 shadow rounded-lg col-span-1 md:col-span-2">
                  <div className="stat-figure text-warning">
                    <i className="fas fa-clock text-2xl"></i>
                  </div>
                  <div className="stat-title">Avg. Time to Complete</div>
                  <div className="stat-value text-warning text-lg" data-testid="stat-average-time">
                    {analytics?.averageTimeToComplete ? `${Math.round(analytics.averageTimeToComplete)} min` : 'N/A'}
                  </div>
                  <div className="stat-desc">From assignment to completion</div>
                </div>
              </div>
            )}

            <div className="modal-action">
              <button 
                className="btn"
                onClick={() => setShowAnalyticsModal(false)}
                data-testid="button-close-analytics"
              >
                Close
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setShowAnalyticsModal(false)}>close</button>
          </form>
        </dialog>
      )}

      {/* Archive Course Confirmation Modal */}
      {showArchiveModal && selectedCourse && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg text-warning mb-4" data-testid="text-archive-modal-title">
              Archive Course: {selectedCourse.title}
            </h3>
            
            <div className="alert alert-warning mb-4">
              <i className="fas fa-exclamation-triangle"></i>
              <div>
                <p className="font-semibold">Warning: This action will archive the course</p>
                <p className="text-sm">Archived courses will be moved to the archive section and will no longer be available for assignment to users.</p>
              </div>
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Type <strong>ARCHIVE</strong> to confirm:</span>
              </label>
              <input 
                type="text" 
                className="input input-bordered" 
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="ARCHIVE"
                data-testid="input-archive-confirmation"
              />
            </div>

            <div className="modal-action">
              <button 
                className="btn btn-ghost" 
                onClick={() => {
                  setShowArchiveModal(false);
                  setConfirmText("");
                }}
                data-testid="button-cancel-archive"
              >
                Cancel
              </button>
              <button 
                className="btn btn-warning" 
                onClick={() => archiveCourseMutation.mutate()}
                disabled={confirmText !== 'ARCHIVE' || archiveCourseMutation.isPending}
                data-testid="button-confirm-archive"
              >
                {archiveCourseMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  'Archive Course'
                )}
              </button>
            </div>
          </div>
        </dialog>
      )}

      {/* Delete Course Confirmation Modal */}
      {showDeleteModal && selectedCourse && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg text-error mb-4" data-testid="text-delete-modal-title">
              Delete Course: {selectedCourse.title}
            </h3>
            
            <div className="alert alert-error mb-4">
              <i className="fas fa-exclamation-triangle"></i>
              <div>
                <p className="font-semibold">Warning: This action cannot be undone</p>
                <p className="text-sm">This will permanently delete the course and all associated data including assignments, completions, and certificates.</p>
              </div>
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Type <strong>DELETE</strong> to confirm:</span>
              </label>
              <input 
                type="text" 
                className="input input-bordered" 
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                data-testid="input-delete-confirmation"
              />
            </div>

            <div className="modal-action">
              <button 
                className="btn btn-ghost" 
                onClick={() => {
                  setShowDeleteModal(false);
                  setConfirmText("");
                }}
                data-testid="button-cancel-delete"
              >
                Cancel
              </button>
              <button 
                className="btn btn-error" 
                onClick={() => deleteCourseMutation.mutate()}
                disabled={confirmText !== 'DELETE' || deleteCourseMutation.isPending}
                data-testid="button-confirm-delete"
              >
                {deleteCourseMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  'Delete Permanently'
                )}
              </button>
            </div>
          </div>
        </dialog>
      )}

      {/* Folder Modal */}
      {showFolderModal && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4" data-testid="text-folder-modal-title">
              {selectedFolderForEdit ? 'Edit Folder' : 'Create New Folder'}
            </h3>
            
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Folder Name</span>
              </label>
              <input 
                type="text" 
                className="input input-bordered" 
                value={folderFormData.name || ''}
                onChange={(e) => setFolderFormData({...folderFormData, name: e.target.value})}
                placeholder="Enter folder name"
                data-testid="input-folder-name"
              />
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Description</span>
              </label>
              <textarea 
                className="textarea textarea-bordered" 
                value={folderFormData.description || ''}
                onChange={(e) => setFolderFormData({...folderFormData, description: e.target.value})}
                placeholder="Enter folder description"
                data-testid="input-folder-description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Color</span>
                </label>
                <input 
                  type="color" 
                  className="input input-bordered h-12" 
                  value={folderFormData.color || '#3b82f6'}
                  onChange={(e) => setFolderFormData({...folderFormData, color: e.target.value})}
                  data-testid="input-folder-color"
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text">Icon</span>
                </label>
                <select 
                  className="select select-bordered"
                  value={folderFormData.icon || 'fas fa-folder'}
                  onChange={(e) => setFolderFormData({...folderFormData, icon: e.target.value})}
                  data-testid="select-folder-icon"
                >
                  <option value="fas fa-folder">📁 Folder</option>
                  <option value="fas fa-baby">👶 Baby</option>
                  <option value="fas fa-heart">❤️ Heart</option>
                  <option value="fas fa-hard-hat">👷 Hard Hat</option>
                  <option value="fas fa-user-md">👨‍⚕️ Doctor</option>
                  <option value="fas fa-shield-alt">🛡️ Shield</option>
                  <option value="fas fa-briefcase">💼 Briefcase</option>
                  <option value="fas fa-graduation-cap">🎓 Graduation</option>
                  <option value="fas fa-tools">🔧 Tools</option>
                </select>
              </div>
            </div>

            <div className="modal-action">
              <button 
                className="btn btn-ghost" 
                onClick={() => {
                  setShowFolderModal(false);
                  setSelectedFolderForEdit(null);
                  setFolderFormData({});
                }}
                data-testid="button-cancel-folder"
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleSaveFolder}
                disabled={!folderFormData.name || createFolderMutation.isPending || updateFolderMutation.isPending}
                data-testid="button-save-folder"
              >
                {(createFolderMutation.isPending || updateFolderMutation.isPending) ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  selectedFolderForEdit ? 'Update Folder' : 'Create Folder'
                )}
              </button>
            </div>
          </div>
        </dialog>
      )}

      {/* Delete Folder Confirmation Modal */}
      {showFolderDeleteModal && selectedFolderForEdit && (
        <dialog className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg text-error mb-4" data-testid="text-delete-folder-modal-title">
              Delete Folder: {selectedFolderForEdit.name}
            </h3>
            
            <div className="alert alert-error mb-4">
              <i className="fas fa-exclamation-triangle"></i>
              <div>
                <p className="font-semibold">Warning: This action cannot be undone</p>
                <p className="text-sm">This will permanently delete the folder. Any courses in this folder will need to be moved to another folder first.</p>
              </div>
            </div>

            <div className="modal-action">
              <button 
                className="btn btn-ghost" 
                onClick={() => {
                  setShowFolderDeleteModal(false);
                  setSelectedFolderForEdit(null);
                }}
                data-testid="button-cancel-delete-folder"
              >
                Cancel
              </button>
              <button 
                className="btn btn-error" 
                onClick={confirmDeleteFolder}
                disabled={deleteFolderMutation.isPending}
                data-testid="button-confirm-delete-folder"
              >
                {deleteFolderMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  'Delete Folder'
                )}
              </button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
}
