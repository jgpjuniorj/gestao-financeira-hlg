```mermaid

architecture-beta
    group internet(internet)[External Access]
    group cluster(cloud)[Kubernetes - gestao-financeira]

    service users(cloud)[Users] in internet
    service tunnel(cloud)[Cloudflare Tunnel] in internet

    group control_plane(server)[Control Plane] in cluster
        service api(server)[API Server] in control_plane
        service scheduler(server)[Scheduler] in control_plane
        service etcd(database)[etcd] in control_plane

    group workers(server)[Worker Nodes] in cluster
        service worker_pool(server)[General Nodes] in workers
        service spot_pool(server)[Spot Nodes] in workers

    group app_stack(server)[Application] in cluster
        service app_deploy(server)[Deployment App] in app_stack
        service app_rs(server)[ReplicaSet App] in app_stack
        service app_pods(server)[App Pods] in app_stack
        service svc(server)[Service ClusterIP] in app_stack

    group db_stack(database)[Database] in cluster
        service db_deploy(server)[StatefulSet MariaDB] in db_stack
        service db_rs(server)[ReplicaSet DB] in db_stack
        service db_pods(server)[MariaDB Pod] in db_stack
        service db_svc(server)[Service DB] in db_stack
        service db_secret(server)[Secret Credentials] in db_stack
        service pvc(disk)[PVC] in db_stack

    junction ingress_split in internet
    junction worker_router in cluster

    users:L --> R:tunnel
    tunnel:B --> T:ingress_split
    ingress_split:B --> T:svc{group}
    svc:R --> L:app_deploy
    app_deploy:B --> T:app_rs
    app_rs:B --> T:app_pods
    app_pods:T -- B:worker_router
    worker_pool:R -- L:worker_router
    spot_pool:T -- B:worker_router

    app_pods:R --> L:db_svc
    db_svc:R --> L:db_deploy
    db_deploy:B --> T:db_rs
    db_rs:B --> T:db_pods
    db_pods:B --> T:pvc
    db_deploy:T --> B:db_secret

    api:B --> T:worker_pool
    api:T --> B:spot_pool
```
