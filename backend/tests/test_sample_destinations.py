"""Existing-project imports preserve identity and roll back both files and rows."""
import pytest
from sqlmodel import Session

from app.core.config import get_settings
from app.models.db_models import ImageRecord
from tests.test_sample_datasets import flower_cache, wait_import as import_flowers
from tests.test_office_fruit import office_cache, wait_import as import_office


@pytest.mark.parametrize("kind", ["flowers", "office-fruit"])
def test_import_into_empty_project_keeps_name_and_id(client, request, kind):
    request.getfixturevalue("flower_cache" if kind == "flowers" else "office_cache")
    project = client.post('/api/projects', json={'name': 'Bài tập của em'}).json()
    before = len(client.get('/api/projects').json())
    payload = {'target_project_id': project['id'], 'class_ids': ['daisy', 'roses'] if kind == 'flowers' else ['laptop', 'phone'], 'images_per_class': 20}
    result = (import_flowers if kind == 'flowers' else import_office)(client, payload)
    assert result['status'] == 'completed', result
    assert result['project_id'] == project['id']
    assert len(client.get('/api/projects').json()) == before
    updated = client.get(f"/api/projects/{project['id']}").json()
    assert updated['name'] == project['name']
    assert updated['num_classes'] == 2 and updated['num_images'] == 40
    data = client.get(f"/api/projects/{project['id']}/dataset").json()
    assert data['sample_source']['id'] == kind
    assert client.get(f"/api/images/{data['classes'][0]['images'][0]['id']}/file").status_code == 200
    # Importing again must not overwrite existing data.
    assert client.post(f'/api/sample-datasets/{kind}/import', json=payload).status_code == 409
    assert client.get(f"/api/projects/{project['id']}/dataset").json() == data
    client.delete(f"/api/projects/{project['id']}")


@pytest.mark.parametrize("kind", ["flowers", "office-fruit"])
@pytest.mark.parametrize("failure", ["processing", "commit"])
def test_target_restored_when_import_fails(client, request, monkeypatch, kind, failure):
    request.getfixturevalue("flower_cache" if kind == "flowers" else "office_cache")
    project = client.post('/api/projects', json={'name': 'Keep my project'}).json()
    pid = project['id']
    previous = client.get(f'/api/projects/{pid}/dataset').json()
    folder = get_settings().projects_dir / pid
    folder.mkdir(exist_ok=True)
    (folder / 'keep.txt').write_text('original')
    folders = set(get_settings().projects_dir.iterdir())
    commit = Session.commit
    def fail_publish(session):
        # The final image rows remain pending when publishing this import.
        if any(isinstance(row, ImageRecord) and row.project_id == pid for row in session.new):
            raise OSError('Simulated commit failure')
        return commit(session)
    if failure == 'commit':
        monkeypatch.setattr(Session, 'commit', fail_publish)
    else:
        from app.services import sample_datasets, image_ingest
        module = sample_datasets if kind == 'flowers' else image_ingest
        process = module.process_image
        calls = 0
        def fail_processing(*args):
            nonlocal calls
            calls += 1
            if calls == 6:
                raise OSError('Simulated disk full')
            return process(*args)
        monkeypatch.setattr(module, 'process_image', fail_processing)
    result = (import_flowers if kind == 'flowers' else import_office)(client, {
        'target_project_id': pid, 'class_ids': ['daisy', 'roses'] if kind == 'flowers' else ['laptop', 'phone'], 'images_per_class': 20})
    assert result['status'] == 'failed', result
    assert client.get(f'/api/projects/{pid}/dataset').json() == previous
    assert (folder / 'keep.txt').read_text() == 'original'
    assert set(get_settings().projects_dir.iterdir()) == folders
    client.delete(f'/api/projects/{pid}')


def test_missing_target_rejected_before_download(client):
    response = client.post('/api/sample-datasets/flowers/import', json={
        'target_project_id': 'missing', 'class_ids': ['daisy', 'roses'], 'images_per_class': 20})
    assert response.status_code == 404


def test_target_is_rechecked_after_downloading(client, flower_cache, monkeypatch):
    from app.services import sample_datasets
    from tests.conftest import make_image_bytes
    project = client.post('/api/projects', json={'name': 'Changed during download'}).json()
    pid = project['id']
    cls = client.get(f'/api/projects/{pid}/dataset').json()['classes'][0]
    def cache_after_upload(*args):
        result = client.post(f'/api/projects/{pid}/images', data={'class_id': cls['id']},
                             files={'files': ('own.png', make_image_bytes((20, 30, 40), 9), 'image/png')})
        assert result.status_code == 201, result.text
        return flower_cache
    monkeypatch.setattr(sample_datasets, 'ensure_flowers', cache_after_upload)
    result = import_flowers(client, {'target_project_id': pid, 'class_ids': ['daisy', 'roses'], 'images_per_class': 20})
    assert result['status'] == 'failed'
    data = client.get(f'/api/projects/{pid}/dataset').json()
    assert data['summary']['total_images'] == 1 and data['classes'][0]['id'] == cls['id']
    assert data['classes'][0]['images'][0]['original_name'] == 'own.png'
    client.delete(f'/api/projects/{pid}')


def test_rename_project_preserves_data_and_rejects_blank_names(client):
    project = client.post('/api/projects', json={'name': 'Original'}).json()
    pid = project['id']
    dataset = client.get(f'/api/projects/{pid}/dataset').json()
    result = client.patch(f'/api/projects/{pid}', json={'name': '  Tên mới  '})
    assert result.status_code == 200
    assert result.json()['name'] == 'Tên mới' and result.json()['id'] == pid
    assert client.get(f'/api/projects/{pid}/dataset').json() == dataset
    assert client.patch(f'/api/projects/{pid}', json={'name': '   '}).status_code == 400
    assert client.get(f'/api/projects/{pid}').json()['name'] == 'Tên mới'
    client.delete(f'/api/projects/{pid}')
