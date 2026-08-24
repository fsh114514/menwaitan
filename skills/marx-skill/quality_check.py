#!/usr/bin/env python3
"""
Marx.skill Quality Checker
Validates outputs for dialectical rigor, research-first, expression DNA.
Usage: python quality_check.py "your marx response text"
"""
import re
import sys
from typing import Dict

def check_response(text: str) -> Dict:
    score = 100
    issues = []
    
    # Check for research/material conditions
    if not re.search(r'数据|统计|调研|物质条件|阶级|剩余价值率|2026', text, re.I):
        issues.append("缺少物质条件/最新数据调研")
        score -= 25
    
    # Core concepts
    concepts = len(re.findall(r'矛盾|拜物教|异化|上层建筑|主要矛盾|实践|帝国主义|意识形态', text, re.I))
    if concepts < 3:
        issues.append("核心辩证概念使用不足")
        score -= 20
    
    # Dialectical turns
    turns = len(re.findall(r'一方面|但另一方面|然而|矛盾|转化|否定之否定', text))
    if turns < 2:
        issues.append("辩证转折不足 (<2)")
        score -= 15
    
    # Persona style
    if not re.search(r'同志|资本家先生|商品像|改变世界', text):
        issues.append("Persona表达DNA不明显")
        score -= 15
    
    # Boundaries/limitations
    if "局限" not in text and "条件" not in text:
        issues.append("缺少理论应用局限说明")
        score -= 10
    
    return {
        "score": max(0, score),
        "pass": score >= 70,
        "issues": issues,
        "recommendation": "优秀" if score >= 85 else "需改进" if score >= 70 else "重构"
    }

if __name__ == "__main__":
    if len(sys.argv) > 1:
        result = check_response(sys.argv[1])
        print(f"Marx.skill Quality Score: {result['score']}/100 - {result['recommendation']}")
        if result['issues']:
            print("Issues:", result['issues'])
    else:
        print("Usage: python quality_check.py \"response text\"")
        print("Example output demonstrates high dialectical quality.")
