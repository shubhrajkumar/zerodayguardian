import React from "react";
import { sanitize } from "@/utils/sanitize";

type Course = {
  id: number;
  title: string;
  difficulty: string;
  description: string;
  progress?: number; // 0-100
};

interface CourseCardProps {
  course: Course;
}

const CourseCard: React.FC<CourseCardProps> = ({ course }) => {
  return (
    <div className="glass-card rounded-lg p-6">
      <h3 className="font-mono text-lg font-semibold mb-2">{sanitize(course.title)}</h3>
      <span className="px-2 py-1 rounded text-xs font-mono bg-primary/20 text-primary mb-2 inline-block">
        {sanitize(course.difficulty)}
      </span>
      <p className="text-sm text-muted-foreground mb-4">{sanitize(course.description)}</p>
      {course.progress !== undefined && (
        <div className="w-full bg-secondary h-2 rounded">
          <div
            className="bg-accent h-2 rounded"
            style={{ width: `${course.progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default CourseCard;