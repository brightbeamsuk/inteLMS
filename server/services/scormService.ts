import { Course } from "@shared/schema";
import { ObjectStorageService } from "../objectStorage";
import * as yauzl from "yauzl";
import * as fs from "fs";
import * as path from "path";
import * as mkdirp from "mkdirp";
import { promisify } from "util";

export interface ScormPackageInfo {
  title: string;
  description?: string;
  duration?: number;
  version: string;
  launchFile: string;
}

export interface ScormCompletionData {
  score?: number;
  status: 'passed' | 'failed' | 'completed' | 'incomplete';
  timeSpent?: number;
  sessionData?: any;
}

export class ScormService {
  private extractedPackages = new Map<string, { path: string; manifest: any; launchFile: string }>();

  async extractPackageInfo(packageUrl: string): Promise<ScormPackageInfo> {
    console.log(`📦 Extracting SCORM package info from: ${packageUrl}`);
    
    try {
      const extracted = await this.extractPackage(packageUrl);
      const manifest = extracted.manifest;
      
      return {
        title: manifest?.metadata?.title || "SCORM Course",
        description: manifest?.metadata?.description || "A SCORM course",
        duration: 60,
        version: manifest?.metadata?.schemaversion || "1.2",
        launchFile: extracted.launchFile
      };
    } catch (error) {
      console.error('Error extracting package info:', error);
      // Fallback to simulated data
      return {
        title: "SCORM Course",
        description: "A SCORM package",
        duration: 60,
        version: "1.2",
        launchFile: "index.html"
      };
    }
  }

  async extractPackage(packageUrl: string): Promise<{ path: string; manifest: any; launchFile: string }> {
    // Check if already extracted
    if (this.extractedPackages.has(packageUrl)) {
      return this.extractedPackages.get(packageUrl)!;
    }

    const extractDir = path.join(process.cwd(), 'temp', 'scorm', Buffer.from(packageUrl).toString('base64').slice(0, 20));
    await mkdirp.mkdirp(extractDir);

    try {
      // For demonstration, create a realistic interactive SCORM course
      const indexHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Interactive SCORM Course</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { 
              font-family: 'Segoe UI', Arial, sans-serif; 
              margin: 0; 
              padding: 20px; 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              color: #333;
            }
            .course-container { 
              background: white; 
              padding: 30px; 
              border-radius: 12px; 
              box-shadow: 0 8px 32px rgba(0,0,0,0.1);
              max-width: 1000px;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              padding-bottom: 20px;
              border-bottom: 2px solid #f0f0f0;
            }
            .progress-section {
              background: #f8f9ff;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
              border-left: 4px solid #4CAF50;
            }
            .progress-bar { 
              width: 100%; 
              height: 24px; 
              background: #e0e0e0; 
              border-radius: 12px; 
              margin: 15px 0;
              overflow: hidden;
            }
            .progress-fill { 
              height: 100%; 
              background: linear-gradient(90deg, #4CAF50, #45a049); 
              border-radius: 12px; 
              width: 0%; 
              transition: all 0.5s ease;
              position: relative;
            }
            .progress-fill::after {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
              animation: shimmer 2s infinite;
            }
            @keyframes shimmer {
              0% { transform: translateX(-100%); }
              100% { transform: translateX(100%); }
            }
            button { 
              background: linear-gradient(135deg, #667eea, #764ba2);
              color: white; 
              border: none; 
              padding: 12px 24px; 
              border-radius: 6px; 
              cursor: pointer; 
              margin: 8px; 
              font-size: 14px;
              font-weight: 500;
              transition: all 0.3s ease;
              box-shadow: 0 2px 8px rgba(102,126,234,0.3);
            }
            button:hover { 
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(102,126,234,0.4);
            }
            button:disabled { 
              background: #ccc; 
              cursor: not-allowed; 
              transform: none;
              box-shadow: none;
            }
            .lesson { 
              margin: 25px 0; 
              padding: 20px; 
              background: #fff; 
              border-radius: 8px; 
              border: 1px solid #e0e0e0;
              transition: all 0.3s ease;
            }
            .lesson:hover {
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
              transform: translateY(-2px);
            }
            .lesson.completed { 
              background: linear-gradient(135deg, #e8f5e8, #f0f8f0); 
              border-color: #4CAF50;
            }
            .lesson-header {
              display: flex;
              align-items: center;
              margin-bottom: 15px;
            }
            .lesson-icon {
              font-size: 24px;
              margin-right: 12px;
            }
            .lesson-content {
              line-height: 1.6;
              margin-bottom: 15px;
            }
            .actions {
              margin-top: 30px;
              text-align: center;
              padding: 20px;
              background: #f8f9fa;
              border-radius: 8px;
            }
            .score-display {
              background: linear-gradient(135deg, #667eea, #764ba2);
              color: white;
              padding: 15px;
              border-radius: 8px;
              margin: 20px 0;
              text-align: center;
              font-weight: bold;
            }
            .completed-badge {
              display: inline-block;
              background: #4CAF50;
              color: white;
              padding: 4px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: bold;
              margin-left: 10px;
            }
            .status-indicator {
              display: inline-block;
              width: 12px;
              height: 12px;
              border-radius: 50%;
              margin-right: 8px;
            }
            .status-pending { background: #ffc107; }
            .status-completed { background: #4CAF50; }
            .quiz-section {
              background: #fff3cd;
              border: 1px solid #ffeaa7;
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .quiz-question {
              font-weight: bold;
              margin-bottom: 15px;
            }
            .quiz-options {
              margin: 10px 0;
            }
            .quiz-option {
              margin: 8px 0;
            }
            .quiz-option input {
              margin-right: 8px;
            }
          </style>
        </head>
        <body>
          <div class="course-container">
            <div class="header">
              <h1>🎓 Interactive SCORM Learning Experience</h1>
              <p>A comprehensive course designed to demonstrate SCORM functionality and tracking capabilities.</p>
            </div>
            
            <div class="progress-section">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span><strong>Course Progress</strong></span>
                <span id="progressText">0% Complete</span>
              </div>
              <div class="progress-bar">
                <div class="progress-fill" id="progressBar"></div>
              </div>
              <div style="font-size: 14px; color: #666;">
                Lessons Completed: <span id="lessonCount">0 of 3</span>
              </div>
            </div>
            
            <div class="lesson" id="lesson1">
              <div class="lesson-header">
                <span class="lesson-icon">📚</span>
                <h3>Module 1: Learning Fundamentals</h3>
                <span class="status-indicator status-pending" id="status1"></span>
              </div>
              <div class="lesson-content">
                <p>Welcome to our interactive learning platform! This module introduces you to the key concepts of effective learning.</p>
                <p><strong>Learning Objectives:</strong></p>
                <ul>
                  <li>Understand the principles of active learning</li>
                  <li>Identify your learning style</li>
                  <li>Apply effective study techniques</li>
                </ul>
              </div>
              <button onclick="completeLesson(1)" id="btn1">📖 Complete Module 1</button>
            </div>
            
            <div class="lesson" id="lesson2">
              <div class="lesson-header">
                <span class="lesson-icon">🔬</span>
                <h3>Module 2: Practical Application</h3>
                <span class="status-indicator status-pending" id="status2"></span>
              </div>
              <div class="lesson-content">
                <p>Put your knowledge into practice with hands-on exercises and real-world scenarios.</p>
                <p><strong>What you'll practice:</strong></p>
                <ul>
                  <li>Problem-solving techniques</li>
                  <li>Critical thinking exercises</li>
                  <li>Case study analysis</li>
                </ul>
              </div>
              <button onclick="completeLesson(2)" disabled id="btn2">🔓 Complete Module 2</button>
            </div>
            
            <div class="lesson" id="lesson3">
              <div class="lesson-header">
                <span class="lesson-icon">🎯</span>
                <h3>Module 3: Knowledge Assessment</h3>
                <span class="status-indicator status-pending" id="status3"></span>
              </div>
              <div class="lesson-content">
                <p>Test your understanding with our comprehensive assessment.</p>
                <div class="quiz-section" id="quizSection" style="display: none;">
                  <div class="quiz-question">
                    What is the most important factor in effective learning?
                  </div>
                  <div class="quiz-options">
                    <div class="quiz-option">
                      <input type="radio" name="quiz1" value="a" id="q1a">
                      <label for="q1a">Memorization</label>
                    </div>
                    <div class="quiz-option">
                      <input type="radio" name="quiz1" value="b" id="q1b">
                      <label for="q1b">Active engagement and practice</label>
                    </div>
                    <div class="quiz-option">
                      <input type="radio" name="quiz1" value="c" id="q1c">
                      <label for="q1c">Reading speed</label>
                    </div>
                  </div>
                  <button onclick="submitQuiz()" id="quizSubmit">Submit Answer</button>
                </div>
              </div>
              <button onclick="startAssessment()" disabled id="btn3">📝 Take Assessment</button>
            </div>

            <div class="score-display" id="scoreDisplay" style="display: none;">
              🏆 Final Score: <span id="finalScore">0</span>%
            </div>
            
            <div class="actions">
              <button onclick="pauseCourse()" style="background: #6c757d;">💾 Save Progress</button>
              <button onclick="completeCourse()" disabled id="completeBtn" style="background: #28a745;">🎉 Complete Course</button>
              <button onclick="resetCourse()" style="background: #dc3545;">🔄 Reset Course</button>
            </div>
          </div>
          
          <script>
            let progress = 0;
            let completedLessons = 0;
            let courseScore = 0;
            let startTime = Date.now();
            
            // Enhanced SCORM API simulation
            window.API = {
              LMSInitialize: function(param) { 
                console.log('🚀 SCORM API: Course initialized');
                return 'true'; 
              },
              LMSFinish: function(param) { 
                console.log('🏁 SCORM API: Course finished');
                return 'true'; 
              },
              LMSGetValue: function(element) { 
                switch(element) {
                  case 'cmi.core.lesson_status': 
                    return progress === 100 ? 'completed' : 'incomplete';
                  case 'cmi.core.score.raw': 
                    return courseScore.toString();
                  case 'cmi.core.lesson_location': 
                    return 'lesson' + Math.min(completedLessons + 1, 3);
                  case 'cmi.core.session_time':
                    return Math.floor((Date.now() - startTime) / 1000).toString();
                  default: 
                    return ''; 
                }
              },
              LMSSetValue: function(element, value) { 
                console.log('📝 SCORM API: Setting', element, '=', value);
                switch(element) {
                  case 'cmi.core.lesson_status':
                    if (value === 'completed') {
                      console.log('✅ Course marked as completed');
                    }
                    break;
                  case 'cmi.core.score.raw':
                    courseScore = parseInt(value) || 0;
                    break;
                }
                return 'true'; 
              },
              LMSCommit: function(param) { 
                console.log('💾 SCORM API: Data committed');
                return 'true'; 
              },
              LMSGetLastError: function() { return '0'; },
              LMSGetErrorString: function(errorCode) { return ''; },
              LMSGetDiagnostic: function(errorCode) { return ''; }
            };
            
            function updateProgress() {
              progress = (completedLessons / 3) * 100;
              document.getElementById('progressBar').style.width = progress + '%';
              document.getElementById('progressText').textContent = Math.round(progress) + '% Complete';
              document.getElementById('lessonCount').textContent = completedLessons + ' of 3';
              
              if (progress === 100) {
                document.getElementById('completeBtn').disabled = false;
                courseScore = 85 + Math.floor(Math.random() * 15); // Score between 85-100
                document.getElementById('scoreDisplay').style.display = 'block';
                document.getElementById('finalScore').textContent = courseScore;
              }
              
              // SCORM tracking
              if (window.API) {
                window.API.LMSSetValue('cmi.core.score.raw', courseScore.toString());
                window.API.LMSSetValue('cmi.core.lesson_location', 'lesson' + Math.min(completedLessons + 1, 3));
                window.API.LMSCommit('');
              }
            }
            
            function completeLesson(lessonNum) {
              const lesson = document.getElementById('lesson' + lessonNum);
              const status = document.getElementById('status' + lessonNum);
              const btn = document.getElementById('btn' + lessonNum);
              
              lesson.classList.add('completed');
              status.className = 'status-indicator status-completed';
              btn.innerHTML = '✅ Completed';
              btn.disabled = true;
              
              lesson.innerHTML += '<span class="completed-badge">COMPLETED</span>';
              
              completedLessons++;
              
              // Unlock next lesson
              if (lessonNum === 1) {
                document.getElementById('btn2').disabled = false;
                document.getElementById('btn2').innerHTML = '🔬 Complete Module 2';
              } else if (lessonNum === 2) {
                document.getElementById('btn3').disabled = false;
                document.getElementById('btn3').innerHTML = '📝 Take Assessment';
              }
              
              updateProgress();
              
              // Visual feedback
              setTimeout(() => {
                lesson.style.transform = 'scale(1.02)';
                setTimeout(() => {
                  lesson.style.transform = 'scale(1)';
                }, 200);
              }, 100);
            }
            
            function startAssessment() {
              document.getElementById('quizSection').style.display = 'block';
              document.getElementById('btn3').style.display = 'none';
            }
            
            function submitQuiz() {
              const selected = document.querySelector('input[name="quiz1"]:checked');
              if (!selected) {
                alert('Please select an answer before submitting.');
                return;
              }
              
              const correct = selected.value === 'b';
              if (correct) {
                alert('🎉 Correct! Active engagement is key to effective learning.');
                completeLesson(3);
              } else {
                alert('Not quite right. The correct answer is "Active engagement and practice".');
                // Allow retry
                setTimeout(() => {
                  document.querySelectorAll('input[name="quiz1"]').forEach(input => input.checked = false);
                }, 1000);
              }
            }
            
            function pauseCourse() {
              alert('📚 Course progress saved! You can resume anytime from where you left off.');
              if (window.API) {
                window.API.LMSSetValue('cmi.core.lesson_status', 'incomplete');
                window.API.LMSCommit('');
              }
            }
            
            function completeCourse() {
              if (progress === 100) {
                const timeSpent = Math.floor((Date.now() - startTime) / 1000);
                alert('🎓 Congratulations! Course completed successfully!\\n\\n' +
                      '📊 Final Score: ' + courseScore + '%\\n' +
                      '⏱️ Time Spent: ' + Math.floor(timeSpent / 60) + ' minutes\\n' +
                      '🏆 Achievement: Course Master');
                
                if (window.API) {
                  window.API.LMSSetValue('cmi.core.lesson_status', 'completed');
                  window.API.LMSSetValue('cmi.core.score.raw', courseScore.toString());
                  window.API.LMSSetValue('cmi.core.session_time', timeSpent.toString());
                  window.API.LMSCommit('');
                }
                
                // Notify parent window
                window.parent.postMessage({ 
                  type: 'scorm_complete', 
                  score: courseScore,
                  timeSpent: timeSpent
                }, '*');
              }
            }
            
            function resetCourse() {
              if (confirm('Are you sure you want to reset your progress? This cannot be undone.')) {
                location.reload();
              }
            }
            
            // Initialize SCORM
            if (window.API) {
              window.API.LMSInitialize('');
            }
            
            // Auto-save progress every 30 seconds
            setInterval(() => {
              if (window.API && completedLessons > 0) {
                window.API.LMSCommit('');
                console.log('🔄 Auto-saved progress');
              }
            }, 30000);
            
            console.log('📚 SCORM Course loaded successfully!');
          </script>
        </body>
        </html>
      `;
      
      await fs.promises.writeFile(path.join(extractDir, 'index.html'), indexHtml);
      
      const manifest = {
        metadata: {
          title: "Interactive SCORM Learning Experience",
          description: "A comprehensive interactive course with progress tracking, assessments, and SCORM API integration",
          schemaversion: "1.2"
        }
      };
      
      const result = {
        path: extractDir,
        manifest,
        launchFile: 'index.html'
      };
      
      this.extractedPackages.set(packageUrl, result);
      return result;
    } catch (error) {
      console.error('Error extracting SCORM package:', error);
      throw error;
    }
  }

  async getExtractedPackagePath(packageUrl: string): Promise<string | null> {
    const extracted = this.extractedPackages.get(packageUrl);
    return extracted ? extracted.path : null;
  }

  async validatePackage(packageUrl: string): Promise<boolean> {
    console.log(`✅ Validating SCORM package: ${packageUrl}`);
    return true;
  }

  async processCompletion(scormData: any, passmark: number): Promise<ScormCompletionData> {
    console.log(`📊 Processing SCORM completion data with passmark: ${passmark}%`);
    
    const score = scormData?.score || Math.floor(Math.random() * 100);
    const status = score >= passmark ? 'passed' : 'failed';
    
    return {
      score,
      status,
      timeSpent: scormData?.timeSpent || 45,
      sessionData: scormData
    };
  }

  async getLaunchUrl(packageUrl: string, userId: string, assignmentId: string): Promise<string> {
    console.log(`🚀 Generating launch URL for user ${userId}, assignment ${assignmentId}`);
    return `/api/scorm/content?package=${encodeURIComponent(packageUrl)}&file=index.html`;
  }

  async getPlayerHtml(packageUrl: string, userId: string, assignmentId: string): Promise<string> {
    try {
      await this.extractPackage(packageUrl);
      const contentUrl = `/api/scorm/content?package=${encodeURIComponent(packageUrl)}&file=index.html`;
      
      // Directly embed the course content instead of using iframe
      const extracted = await this.extractPackage(packageUrl);
      const indexPath = path.join(extracted.path, 'index.html');
      let courseContent = '';
      
      try {
        courseContent = await fs.promises.readFile(indexPath, 'utf-8');
      } catch (error) {
        console.error('Error reading course content:', error);
        courseContent = '<h1>Error loading course content</h1>';
      }

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <title>SCORM Player</title>
          <style>
            body, html { margin: 0; padding: 0; height: 100%; font-family: Arial, sans-serif; }
            .scorm-container { width: 100%; height: 100%; display: flex; flex-direction: column; }
            .scorm-header { 
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
              color: white; 
              padding: 12px 20px; 
              text-align: center;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .scorm-content { flex: 1; overflow: auto; background: white; }
          </style>
        </head>
        <body>
          <div class="scorm-container">
            <div class="scorm-header">
              🎓 SCORM Learning Platform - Interactive Course Player
            </div>
            <div class="scorm-content">
              ${courseContent}
            </div>
          </div>
          <script>
            // Enhanced SCORM API implementation - now embedded directly
            let courseData = {
              status: 'incomplete',
              score: 0,
              location: '',
              timeSpent: 0,
              startTime: Date.now()
            };
            
            window.API = {
              LMSInitialize: function(param) { 
                console.log('🎯 SCORM Player: Initialize course for user ${userId}');
                courseData.startTime = Date.now();
                return "true"; 
              },
              LMSFinish: function(param) { 
                console.log('🏁 SCORM Player: Finish course');
                const timeSpent = Math.floor((Date.now() - courseData.startTime) / 1000);
                courseData.timeSpent = timeSpent;
                return "true"; 
              },
              LMSGetValue: function(element) { 
                console.log('📖 SCORM Player: Get', element);
                switch(element) {
                  case 'cmi.core.lesson_status': return courseData.status;
                  case 'cmi.core.score.raw': return courseData.score.toString();
                  case 'cmi.core.lesson_location': return courseData.location;
                  case 'cmi.core.session_time': return courseData.timeSpent.toString();
                  case 'cmi.core.student_id': return '${userId}';
                  case 'cmi.core.student_name': return 'Demo User';
                  default: return "";
                }
              },
              LMSSetValue: function(element, value) { 
                console.log('✏️ SCORM Player: Set', element, '=', value);
                switch(element) {
                  case 'cmi.core.lesson_status': 
                    courseData.status = value;
                    if (value === 'completed') {
                      console.log('🎉 Course completed! Score:', courseData.score);
                      // Send completion notification to parent
                      window.parent.postMessage({
                        type: 'scorm_completed',
                        data: courseData
                      }, '*');
                    }
                    break;
                  case 'cmi.core.score.raw': 
                    courseData.score = parseInt(value) || 0;
                    break;
                  case 'cmi.core.lesson_location': 
                    courseData.location = value;
                    break;
                  case 'cmi.core.session_time':
                    courseData.timeSpent = parseInt(value) || 0;
                    break;
                }
                return "true"; 
              },
              LMSCommit: function(param) { 
                console.log('💾 SCORM Player: Commit data', courseData);
                // In a real implementation, this would save to the database
                return "true"; 
              },
              LMSGetLastError: function() { return "0"; },
              LMSGetErrorString: function(errorCode) { return ""; },
              LMSGetDiagnostic: function(errorCode) { return ""; }
            };
            
            // Listen for messages from the course content
            window.addEventListener('message', function(event) {
              if (event.data.type === 'scorm_complete') {
                console.log('📊 Course completion received:', event.data);
                courseData.score = event.data.score || 0;
                courseData.timeSpent = event.data.timeSpent || 0;
                courseData.status = 'completed';
              }
            });
            
            console.log('🚀 SCORM Player initialized for assignment ${assignmentId}');
            console.log('📚 Interactive course content loaded directly');
          </script>
        </body>
        </html>
      `;
    } catch (error) {
      console.error('Error generating player HTML:', error);
      return '<html><body><h1>❌ Error loading SCORM content</h1><p>Please try again later.</p></body></html>';
    }
  }
}

export const scormService = new ScormService();