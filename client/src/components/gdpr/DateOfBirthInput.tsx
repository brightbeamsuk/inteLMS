import { useState, useEffect } from "react";
import { Calendar, CalendarDays, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";

interface DateOfBirthInputProps {
  value: string;
  onChange: (date: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function DateOfBirthInput({
  value,
  onChange,
  disabled = false,
  required = true,
  className = "",
  "data-testid": testId
}: DateOfBirthInputProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    value ? new Date(value) : undefined
  );
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [inputMethod, setInputMethod] = useState<'calendar' | 'manual'>('calendar');
  const [manualDate, setManualDate] = useState({
    day: "",
    month: "",
    year: ""
  });
  const [validationError, setValidationError] = useState<string>("");

  // Generate years (current year down to 120 years ago)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 121 }, (_, i) => currentYear - i);
  
  // Months array
  const months = [
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" }
  ];

  // Generate days based on selected month and year
  const getDaysInMonth = (month: string, year: string) => {
    if (!month || !year) return 31;
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    return daysInMonth;
  };

  const days = manualDate.month && manualDate.year 
    ? Array.from({ length: getDaysInMonth(manualDate.month, manualDate.year) }, (_, i) => i + 1)
    : Array.from({ length: 31 }, (_, i) => i + 1);

  // Validate date
  const validateDate = (date: Date): string => {
    const now = new Date();
    const maxAge = 120;
    const minDate = new Date(now.getFullYear() - maxAge, now.getMonth(), now.getDate());
    
    if (date > now) {
      return "Date of birth cannot be in the future";
    }
    
    if (date < minDate) {
      return `Date of birth cannot be more than ${maxAge} years ago`;
    }
    
    return "";
  };

  // Handle calendar date selection
  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;
    
    const error = validateDate(date);
    setValidationError(error);
    
    if (!error) {
      setSelectedDate(date);
      const isoString = format(date, 'yyyy-MM-dd');
      onChange(isoString);
      setIsCalendarOpen(false);
    }
  };

  // Handle manual date input
  const handleManualDateChange = (field: 'day' | 'month' | 'year', value: string) => {
    const newManualDate = { ...manualDate, [field]: value };
    setManualDate(newManualDate);

    // If all fields are filled, validate and set the date
    if (newManualDate.day && newManualDate.month && newManualDate.year) {
      const dateString = `${newManualDate.year}-${newManualDate.month.padStart(2, '0')}-${newManualDate.day.padStart(2, '0')}`;
      const date = new Date(dateString);
      
      // Check if the date is valid (handles cases like Feb 30)
      if (
        date.getFullYear() === parseInt(newManualDate.year) &&
        date.getMonth() === parseInt(newManualDate.month) - 1 &&
        date.getDate() === parseInt(newManualDate.day)
      ) {
        const error = validateDate(date);
        setValidationError(error);
        
        if (!error) {
          setSelectedDate(date);
          onChange(dateString);
        }
      } else {
        setValidationError("Please enter a valid date");
      }
    } else {
      setValidationError("");
    }
  };

  // Update manual date when value changes externally
  useEffect(() => {
    if (value && value !== format(selectedDate || new Date(), 'yyyy-MM-dd')) {
      const date = new Date(value);
      setSelectedDate(date);
      setManualDate({
        day: date.getDate().toString(),
        month: (date.getMonth() + 1).toString().padStart(2, '0'),
        year: date.getFullYear().toString()
      });
    }
  }, [value]);

  // Clear validation error when switching input methods
  useEffect(() => {
    setValidationError("");
  }, [inputMethod]);

  return (
    <div className={`space-y-4 ${className}`} data-testid={testId}>
      <div className="space-y-2">
        <Label htmlFor="dob-input" className="text-sm font-medium">
          Date of Birth {required && <span className="text-red-500">*</span>}
        </Label>
        
        {/* Input Method Toggle */}
        <div className="flex gap-2 mb-4">
          <Button
            type="button"
            variant={inputMethod === 'calendar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setInputMethod('calendar')}
            disabled={disabled}
            data-testid="button-calendar-method"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Calendar
          </Button>
          <Button
            type="button"
            variant={inputMethod === 'manual' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setInputMethod('manual')}
            disabled={disabled}
            data-testid="button-manual-method"
          >
            <CalendarDays className="h-4 w-4 mr-2" />
            Manual Entry
          </Button>
        </div>

        {/* Calendar Input */}
        {inputMethod === 'calendar' && (
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start text-left font-normal"
                disabled={disabled}
                data-testid="button-open-calendar"
              >
                <Calendar className="mr-2 h-4 w-4" />
                {selectedDate ? format(selectedDate, 'PPP') : 'Select your date of birth'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={handleCalendarSelect}
                disabled={disabled}
                captionLayout="dropdown-buttons"
                fromYear={currentYear - 120}
                toYear={currentYear}
                data-testid="calendar-picker"
              />
            </PopoverContent>
          </Popover>
        )}

        {/* Manual Input */}
        {inputMethod === 'manual' && (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label htmlFor="day-select" className="text-xs text-muted-foreground">Day</Label>
              <Select 
                value={manualDate.day} 
                onValueChange={(value) => handleManualDateChange('day', value)}
                disabled={disabled}
              >
                <SelectTrigger data-testid="select-day">
                  <SelectValue placeholder="Day" />
                </SelectTrigger>
                <SelectContent>
                  {days.map((day) => (
                    <SelectItem key={day} value={day.toString().padStart(2, '0')}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="month-select" className="text-xs text-muted-foreground">Month</Label>
              <Select 
                value={manualDate.month} 
                onValueChange={(value) => handleManualDateChange('month', value)}
                disabled={disabled}
              >
                <SelectTrigger data-testid="select-month">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="year-select" className="text-xs text-muted-foreground">Year</Label>
              <Select 
                value={manualDate.year} 
                onValueChange={(value) => handleManualDateChange('year', value)}
                disabled={disabled}
              >
                <SelectTrigger data-testid="select-year">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Alternative Direct Text Input */}
        <div className="pt-2">
          <Label htmlFor="dob-text" className="text-xs text-muted-foreground mb-1 block">
            Or enter directly (YYYY-MM-DD format)
          </Label>
          <Input
            id="dob-text"
            type="date"
            value={value}
            onChange={(e) => {
              const date = new Date(e.target.value);
              if (!isNaN(date.getTime())) {
                const error = validateDate(date);
                setValidationError(error);
                if (!error) {
                  setSelectedDate(date);
                  setManualDate({
                    day: date.getDate().toString(),
                    month: (date.getMonth() + 1).toString().padStart(2, '0'),
                    year: date.getFullYear().toString()
                  });
                }
              }
              onChange(e.target.value);
            }}
            disabled={disabled}
            className="w-full"
            max={format(new Date(), 'yyyy-MM-dd')}
            min={format(new Date(currentYear - 120, 0, 1), 'yyyy-MM-dd')}
            data-testid="input-date-direct"
          />
        </div>

        {/* Validation Error */}
        {validationError && (
          <Alert variant="destructive" data-testid="alert-validation-error">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}

        {/* Selected Date Display */}
        {selectedDate && !validationError && (
          <div className="text-sm text-muted-foreground" data-testid="text-selected-date">
            Selected: {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </div>
        )}
      </div>
    </div>
  );
}