interface TrainingMatrixStatusIconProps {
  status: 'red' | 'amber' | 'green' | 'blue' | 'grey' | 'blank' | 'failed';
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export function TrainingMatrixStatusIcon({ 
  status, 
  onClick, 
  size = 'md' 
}: TrainingMatrixStatusIconProps) {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm', 
    lg: 'w-10 h-10 text-base'
  };

  const getStatusConfig = () => {
    switch (status) {
      case 'green':
        return {
          bgColor: 'bg-green-500',
          icon: 'fas fa-check',
          iconColor: 'text-white',
          title: 'Completed and current'
        };
      case 'red':
        return {
          bgColor: 'bg-red-500',
          icon: 'fas fa-exclamation',
          iconColor: 'text-white',
          title: 'Overdue or expired'
        };
      case 'amber':
        return {
          bgColor: 'bg-amber-500',
          icon: 'fas fa-exclamation',
          iconColor: 'text-white',
          title: 'Expiring soon'
        };
      case 'blue':
        return {
          bgColor: 'bg-blue-500',
          icon: 'fas fa-spinner fa-spin',
          iconColor: 'text-white',
          title: 'In progress'
        };
      case 'failed':
        return {
          bgColor: 'bg-blue-600',
          icon: 'fas fa-exclamation',
          iconColor: 'text-white',
          title: 'Failed attempt'
        };
      case 'grey':
        return {
          bgColor: 'bg-gray-400',
          icon: 'fas fa-minus',
          iconColor: 'text-white',
          title: 'Not assigned'
        };
      case 'blank':
      default:
        return {
          bgColor: 'bg-gray-200',
          icon: '',
          iconColor: 'text-gray-400',
          title: 'No data'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div
      className={`
        ${sizeClasses[size]} 
        ${config.bgColor} 
        rounded-full 
        flex 
        items-center 
        justify-center 
        border-2 
        border-white 
        shadow-sm
        ${onClick ? 'cursor-pointer hover:scale-110 transition-transform' : ''}
      `}
      onClick={onClick}
      title={config.title}
      data-testid={`status-icon-${status}`}
    >
      {config.icon && (
        <i className={`${config.icon} ${config.iconColor}`} />
      )}
    </div>
  );
}