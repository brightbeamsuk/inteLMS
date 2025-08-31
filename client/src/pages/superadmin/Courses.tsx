import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";

interface Course {
  id: string;
  title: string;
  description: string;
  estimatedDuration: number;
  passmark: number;
  category: string;
  tags: string;
  coverImageUrl?: string;
  status: string;
  createdAt: string;
}

export function SuperAdminCourses() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const { data: courses = [], isLoading } = useQuery<Course[]>({
    queryKey: ['/api/courses'],
  });

  // Filter courses based on search and category
  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         course.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || course.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = [...new Set(courses.map(course => course.category).filter(Boolean))];

  return (
    <div>
      {/* Breadcrumbs */}
      <div className="text-sm breadcrumbs mb-6">
        <ul>
          <li><a data-testid="link-superadmin">SuperAdmin</a></li>
          <li className="font-semibold" data-testid="text-current-page">Courses</li>
        </ul>
      </div>

      {/* Page Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold" data-testid="text-page-title">Global Course Library</h1>
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
            <div className="text-6xl mb-4">📚</div>
            <h3 className="text-2xl font-bold mb-2">No courses found</h3>
            <p className="text-base-content/60 mb-4">
              {searchTerm || selectedCategory ? 
                "No courses match your current filters" : 
                "No courses have been published to the library yet"
              }
            </p>
            <Link href="/superadmin/course-builder">
              <button className="btn btn-primary" data-testid="button-create-first-course">
                <i className="fas fa-plus"></i> Create First Course
              </button>
            </Link>
          </div>
        ) : (
          filteredCourses.map((course) => (
            <div key={course.id} className="card bg-base-200 shadow-sm hover:shadow-md transition-shadow" data-testid={`card-course-${course.id}`}>
              <figure className="px-4 pt-4">
                <div className="w-full h-32 bg-base-300 rounded-lg flex items-center justify-center">
                  {course.coverImageUrl ? (
                    <img src={course.coverImageUrl} alt={course.title} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <i className="fas fa-graduation-cap text-4xl text-base-content/40"></i>
                  )}
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
                    }}
                    data-testid={`button-course-details-${course.id}`}
                  >
                    <i className="fas fa-info-circle"></i> Details
                  </button>
                  <button 
                    className="btn btn-sm btn-primary"
                    data-testid={`button-course-analytics-${course.id}`}
                  >
                    <i className="fas fa-chart-bar"></i> Analytics
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Course Details Modal */}
      {showDetailsModal && selectedCourse && (
        <dialog className="modal modal-open">
          <div className="modal-box max-w-4xl">
            <h3 className="font-bold text-lg mb-4" data-testid="text-course-details-title">
              {selectedCourse.title}
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2">Course Information</h4>
                <div className="space-y-2 text-sm">
                  <div><strong>Duration:</strong> <span data-testid="text-details-duration">{selectedCourse.estimatedDuration} minutes</span></div>
                  <div><strong>Pass Mark:</strong> <span data-testid="text-details-passmark">{selectedCourse.passmark}%</span></div>
                  <div><strong>Category:</strong> <span data-testid="text-details-category">{selectedCourse.category || 'Uncategorised'}</span></div>
                  <div><strong>Tags:</strong> <span data-testid="text-details-tags">{selectedCourse.tags || 'None'}</span></div>
                </div>
                
                <h4 className="font-semibold mt-4 mb-2">Description</h4>
                <p className="text-sm text-base-content/80" data-testid="text-details-description">
                  {selectedCourse.description}
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Analytics</h4>
                <div className="stats stats-vertical shadow">
                  <div className="stat">
                    <div className="stat-title">Organisations Using</div>
                    <div className="stat-value text-sm" data-testid="stat-organisations-using">12</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Total Assignments</div>
                    <div className="stat-value text-sm" data-testid="stat-total-assignments">347</div>
                  </div>
                  <div className="stat">
                    <div className="stat-title">Completions</div>
                    <div className="stat-value text-sm" data-testid="stat-total-completions">289</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button className="btn btn-sm btn-outline" data-testid="button-preview-course-details">
                <i className="fas fa-play"></i> Preview
              </button>
              <button className="btn btn-sm btn-secondary" data-testid="button-edit-course-details">
                <i className="fas fa-edit"></i> Edit Course
              </button>
            </div>

            <div className="modal-action">
              <button 
                className="btn"
                onClick={() => setShowDetailsModal(false)}
                data-testid="button-close-course-details"
              >
                Close
              </button>
            </div>
          </div>
          <form method="dialog" className="modal-backdrop">
            <button onClick={() => setShowDetailsModal(false)}>close</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
