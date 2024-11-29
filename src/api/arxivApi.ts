import { requestUrl } from 'obsidian';
import { ArxivMetadataType, CitationInfo } from '../types/arxiv';
import { normalizeArxivUrl, extractArxivId } from '../utils/urlUtils';

export class ArxivApi {
    async fetchArxivMetadata(url: string): Promise<ArxivMetadataType> {
        const arxivId = extractArxivId(url);
        if (!arxivId) {
            throw new Error('유효한 Arxiv URL이 아닙니다.');
        }

        const apiUrl = `https://export.arxiv.org/api/query?id_list=${arxivId}`;
        
        const response = await requestUrl({
            url: apiUrl,
            headers: {
                'User-Agent': 'ObsidianArxivPlugin/1.0'
            }
        });

        if (response.status !== 200) {
            throw new Error(`Arxiv API 요청 실패: ${response.status}`);
        }

        return this.parseArxivResponse(response.text);
    }

    async fetchCitationInfo(arxivId: string): Promise<CitationInfo> {
        const semanticScholarId = `arXiv:${arxivId}`;
        const url = `https://api.semanticscholar.org/v1/paper/${semanticScholarId}`;

        try {
            const response = await requestUrl({ url });
            if (response.status === 200) {
                const data = JSON.parse(response.text);
                return {
                    numCitedBy: data.numCitedBy || 0,
                    numCiting: data.numCiting || 0,
                    influentialCitations: this.getInfluentialPapers(data.citations),
                    influentialReferences: this.getInfluentialPapers(data.references)
                };
            }
        } catch (error) {
            console.error(`Error fetching citation info for ${arxivId}:`, error);
        }

        return {
            numCitedBy: 0,
            numCiting: 0,
            influentialCitations: [],
            influentialReferences: []
        };
    }

    private parseArxivResponse(xmlText: string): ArxivMetadataType {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "text/xml");

        const entry = xmlDoc.querySelector('entry');
        if (!entry) {
            throw new Error('논문 정보를 찾을 수 없습니다.');
        }

        return {
            title: entry.querySelector('title')?.textContent?.trim() || '제목 없음',
            paperLink: entry.querySelector('id')?.textContent || '',
            publishDate: entry.querySelector('published')?.textContent?.split('T')[0] || '날짜 없음',
            authors: Array.from(entry.querySelectorAll('author name'))
                .map(author => author.textContent)
                .join(', '),
            abstract: this.formatAbstract(entry.querySelector('summary')?.textContent || 'Abstract 없음')
        };
    }

    private formatAbstract(text: string): string {
        return text.trim()
            .replace(/\n+/g, '\n')
            .replace(/\s+/g, ' ')
            .split('\n')
            .map(para => para.trim())
            .join('\n\n');
    }

    private getInfluentialPapers(papers: any[]): any[] {
        return papers
            ?.filter(paper => paper.isInfluential)
            .map(paper => ({
                paperId: paper.paperId,
                title: paper.title,
                url: paper.url,
                venue: paper.venue,
                year: paper.year,
                authors: paper.authors?.map((author: any) => author.name).join(', ') || '',
                arxivId: paper.arxivId,
                doi: paper.doi,
                isInfluential: paper.isInfluential,
                citationCount: paper.citationCount,
                intent: paper.intent
            })) || [];
    }
} 