import {DatabaseSync} from 'node:sqlite';
export function testDB(sql){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(sql);
 class Statement{
  constructor(query,args=[]){this.query=query;this.args=args}
  bind(...args){return new Statement(this.query,args)}
  async first(){return sqlite.prepare(this.query).get(...this.args)??null}
  async all(){return {results:sqlite.prepare(this.query).all(...this.args)}}
  async run(){const result=sqlite.prepare(this.query).run(...this.args);return {success:true,meta:{changes:Number(result.changes)}}}
 }
 return {prepare:query=>new Statement(query),async batch(statements){sqlite.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}},sqlite}
}
