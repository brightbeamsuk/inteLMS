import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { Clock, User, Database, Lock, AlertCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AuditLogEntry {
  id: string;
  organisationId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
  user?: {
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };
}

const ACTIONS_PER_PAGE = 50;

export default function AuditLog() {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  
  const { data: auditLogs, isLoading, error } = useQuery({
    queryKey: ['/api/admin/audit-logs', user?.organisationId, currentPage],
    queryFn: async () => {
      if (!user?.organisationId) return [];
      
      const limit = ACTIONS_PER_PAGE;
      const offset = (currentPage - 1) * ACTIONS_PER_PAGE;
      
      const response = await fetch(`/api/admin/audit-logs/${user.organisationId}?limit=${limit}&offset=${offset}`);
      
      if (!response.ok) {
        if (response.status === 403) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Access denied');
        }
        throw new Error('Failed to fetch audit logs');
      }
      
      return response.json();
    },
    enabled: !!user?.organisationId,
  });

  const getActionBadgeVariant = (action: string) => {
    const lowerAction = action.toLowerCase();
    if (lowerAction.includes('create') || lowerAction.includes('add')) {
      return 'default'; // Blue
    }
    if (lowerAction.includes('update') || lowerAction.includes('edit') || lowerAction.includes('modify')) {
      return 'secondary'; // Gray
    }
    if (lowerAction.includes('delete') || lowerAction.includes('remove')) {
      return 'destructive'; // Red
    }
    if (lowerAction.includes('login') || lowerAction.includes('authenticate')) {
      return 'outline'; // Green outline
    }
    return 'secondary';
  };

  const getResourceIcon = (resource: string) => {
    const lowerResource = resource.toLowerCase();
    if (lowerResource.includes('user') || lowerResource.includes('staff')) {
      return <User className="h-4 w-4" />;
    }
    if (lowerResource.includes('course') || lowerResource.includes('training')) {
      return <Database className="h-4 w-4" />;
    }
    if (lowerResource.includes('auth') || lowerResource.includes('login')) {
      return <Lock className="h-4 w-4" />;
    }
    return <Clock className="h-4 w-4" />;
  };

  const formatUserName = (user?: { firstName: string | null; lastName: string | null; email: string | null }) => {
    if (!user) return 'Unknown User';
    
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim();
    
    if (fullName) {
      return fullName;
    }
    
    return user.email || 'Unknown User';
  };

  const formatDetails = (details: any) => {
    if (!details) return 'No additional details';
    
    // If it's already a string, return it
    if (typeof details === 'string') {
      try {
        // Try to parse it as JSON for prettier display
        const parsed = JSON.parse(details);
        return formatJsonDetails(parsed);
      } catch {
        // If it's not valid JSON, return as-is
        return details;
      }
    }
    
    // If it's an object, format it
    if (typeof details === 'object') {
      return formatJsonDetails(details);
    }
    
    return String(details);
  };

  const formatJsonDetails = (obj: any) => {
    if (!obj || typeof obj !== 'object') return String(obj);
    
    // Create a human-readable summary
    const entries = Object.entries(obj);
    if (entries.length === 0) return 'No details';
    
    return entries
      .map(([key, value]) => {
        const formattedKey = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').toLowerCase();
        const capitalizedKey = formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1);
        
        if (typeof value === 'boolean') {
          return `${capitalizedKey}: ${value ? 'Yes' : 'No'}`;
        }
        if (Array.isArray(value)) {
          return `${capitalizedKey}: ${value.join(', ')}`;
        }
        return `${capitalizedKey}: ${value}`;
      })
      .join(', ');
  };

  // Handle feature access error
  if (error && error.message.includes('Audit log feature not available')) {
    return (
      <div className="p-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            The audit log feature is not available for your current plan. Please upgrade your plan to access audit logs.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Handle other errors
  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error.message || 'Failed to load audit logs. Please try again.'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const hasLogs = auditLogs && auditLogs.length > 0;
  const hasMorePages = hasLogs && auditLogs.length === ACTIONS_PER_PAGE;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="page-title">Audit Log</h1>
          <p className="text-muted-foreground">
            Track all actions and changes within your organisation
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : hasLogs ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log: AuditLogEntry) => (
                    <TableRow key={log.id} data-testid={`audit-log-row-${log.id}`}>
                      <TableCell className="font-mono text-sm">
                        <div className="flex flex-col">
                          <span>{format(new Date(log.createdAt), 'MMM dd, yyyy')}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(log.createdAt), 'HH:mm:ss')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {formatUserName(log.user)}
                            </span>
                            {log.user?.email && (
                              <span className="text-xs text-muted-foreground">
                                {log.user.email}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={getActionBadgeVariant(log.action)}
                          data-testid={`action-badge-${log.id}`}
                        >
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getResourceIcon(log.resource)}
                          <span className="font-medium">{log.resource}</span>
                          {log.resourceId && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {log.resourceId.substring(0, 8)}...
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate" title={formatDetails(log.details)}>
                          {formatDetails(log.details)}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {log.ipAddress || 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              <div className="flex items-center justify-between pt-4">
                <div className="text-sm text-muted-foreground">
                  Page {currentPage} of audit logs
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    data-testid="prev-page-button"
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => p + 1)}
                    disabled={!hasMorePages}
                    data-testid="next-page-button"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground mb-2">
                No audit logs found
              </h3>
              <p className="text-sm text-muted-foreground">
                Activity will appear here once users start performing actions
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}